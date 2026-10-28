/* ==========================================================================
   LUXCV - editor-form.js
   Builds and runs the resume editing form.

   • The form owns one resume object (see data-model.js). Typing updates that
     object in place and calls options.onChange(resume).
   • Repeated entries (experience, education, projects, certifications,
     languages) and skills carry stable ids, so editing or removing one never
     touches another. Removing an entry offers Undo.
   • All user text goes in through textContent / .value - never innerHTML.
   • Validation messages come from validation.js. A message appears for a field
     after the user leaves it (or after "reveal all"), and clears as soon as the
     value becomes valid.

   Public API:  EditorForm.create(root, options) → controller
     options: { resume, onChange(resume), announce(text) }
     controller: getResume, setResume, validate(reveal), describeErrors,
                 focusKey, refreshErrors
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var LEVELS = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'];
  var PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var PHOTO_MAX_BYTES = 8 * 1024 * 1024;
  var PHOTO_SIZE = 360;
  var UNDO_MS = 10000;

  /* Section definitions: heading, empty-state copy and the noun used in
     button labels. `list` sections hold repeated entries. */
  var LISTS = {
    experience: { title: 'Work experience', noun: 'experience', add: 'Add experience',
      empty: 'No work experience yet. Add a role, or skip this section if it doesn’t apply.' },
    education: { title: 'Education', noun: 'education entry', add: 'Add education',
      empty: 'No education added yet. Add a school, college or course.' },
    projects: { title: 'Projects', noun: 'project', add: 'Add project',
      empty: 'No projects yet. Add something you built or led.' },
    certifications: { title: 'Certifications', noun: 'certification', add: 'Add certification',
      empty: 'No certifications yet. Add a licence or course certificate.' },
    languages: { title: 'Languages', noun: 'language', add: 'Add language',
      empty: 'No languages added yet.' }
  };

  function create(root, options) {
    var Data = LuxCV.Data;
    var V = LuxCV.Validation;
    var L = V.LIMITS;
    var el = LuxCV.Dom.el;
    var clear = LuxCV.Dom.clear;

    var opts = options || {};
    var resume = Data.migrateResume(opts.resume);
    var fields = {};          /* error key → { input, error, label } */
    var touched = {};         /* error keys the user has left */
    var revealAll = false;
    var lastResult = { errors: {}, count: 0, firstKey: '' };
    var undoState = null;
    var undoTimer = 0;
    var sections = {};        /* name → { details, meta, body } */
    var listNodes = {};       /* list name → <ol> */
    var skillList = null;
    var skillInput = null;
    var skillMessage = null;
    var undoBar = null;
    var photoBox = null;
    var pointerDown = false;
    var refreshPending = false;

    function pointerReleased() {
      pointerDown = false;
      if (refreshPending) {
        refreshPending = false;
        window.setTimeout(refreshErrors, 0);
      }
    }
    document.addEventListener('pointerdown', function () { pointerDown = true; }, true);
    document.addEventListener('pointerup', pointerReleased, true);
    document.addEventListener('pointercancel', pointerReleased, true);

    function announce(text) {
      if (typeof opts.announce === 'function') {
        opts.announce(text);
      }
    }

    function changed() {
      Object.keys(listNodes).forEach(retitle);
      refreshErrors();
      updateMeta();
      if (typeof opts.onChange === 'function') {
        opts.onChange(resume);
      }
    }

    /* ---------- validation display ---------- */

    function fieldId(key) {
      return 'f-' + key.replace(/\./g, '-');
    }

    function refreshErrors() {
      lastResult = V.validateResume(resume);
      Object.keys(fields).forEach(function (key) {
        var f = fields[key];
        var message = lastResult.errors[key] || '';
        var show = message && (revealAll || touched[key]);
        f.error.textContent = show ? message : '';
        f.error.hidden = !show;
        if (show) {
          f.input.setAttribute('aria-invalid', 'true');
        } else {
          f.input.removeAttribute('aria-invalid');
        }
        f.wrap.classList.toggle('field--invalid', !!show);
      });
      return lastResult;
    }

    function validate(reveal) {
      if (reveal) {
        revealAll = true;
      }
      return refreshErrors();
    }

    function describeErrors(result) {
      var errors = (result || lastResult).errors;
      return Object.keys(errors).map(function (key) {
        var f = fields[key];
        return { key: key, label: f ? f.label : key, message: errors[key] };
      });
    }

    function focusKey(key) {
      var f = fields[key];
      if (!f) {
        return false;
      }
      var details = f.input.closest('details');
      if (details && !details.open) {
        details.open = true;
      }
      f.input.focus();
      if (f.input.scrollIntoView) {
        f.input.scrollIntoView({ block: 'center' });
      }
      return true;
    }

    /* ---------- field builder ---------- */

    /* spec: { key, label, value, required, hint, type, textarea, rows,
               maxlength, autocomplete, inputmode, placeholder, wide, select,
               onInput(value) } */
    function field(spec) {
      var id = fieldId(spec.key);
      var hintId = id + '-hint';
      var errorId = id + '-error';
      var control;

      if (spec.select) {
        control = el('select', { class: 'select', id: id }, spec.select.map(function (opt) {
          return el('option', { value: opt, text: opt || 'Select…' });
        }));
        if (spec.value && spec.select.indexOf(spec.value) === -1) {
          control.appendChild(el('option', { value: spec.value, text: spec.value }));
        }
        control.value = spec.value || '';
      } else if (spec.textarea) {
        control = el('textarea', {
          class: 'textarea', id: id, rows: spec.rows || 4, maxlength: spec.maxlength,
          placeholder: spec.placeholder
        });
        control.value = spec.value || '';
      } else {
        control = el('input', {
          class: 'input', id: id, type: spec.type || 'text', maxlength: spec.maxlength,
          placeholder: spec.placeholder, autocomplete: spec.autocomplete || 'off',
          inputmode: spec.inputmode, spellcheck: spec.spellcheck === false ? 'false' : null
        });
        control.value = spec.value || '';
      }

      if (spec.required) {
        control.setAttribute('aria-required', 'true');
      }
      control.setAttribute('aria-describedby', (spec.hint ? hintId + ' ' : '') + errorId);
      control.setAttribute('data-key', spec.key);

      var error = el('p', { class: 'field__error', id: errorId, hidden: true });
      var wrap = el('div', { class: 'field' + (spec.wide ? ' field--wide' : '') }, [
        el('label', { class: 'field__label', for: id }, [
          spec.label,
          spec.required ? el('span', { class: 'field__req', text: ' *', 'aria-hidden': 'true' }) : null,
          spec.required ? el('span', { class: 'visually-hidden', text: ' (required)' }) : null
        ]),
        control,
        spec.hint ? el('p', { class: 'field__hint', id: hintId, text: spec.hint }) : null,
        error
      ]);

      fields[spec.key] = { input: control, error: error, wrap: wrap, label: spec.label };

      var eventName = spec.select ? 'change' : 'input';
      control.addEventListener(eventName, function () {
        spec.onInput(control.value);
        changed();
      });
      control.addEventListener('blur', function () {
        touched[spec.key] = true;
        /* If the blur came from pressing the mouse or a finger somewhere else,
           showing the message now would shift the page under the pointer and
           the click would miss. Wait until the pointer is released. */
        if (pointerDown) {
          refreshPending = true;
        } else {
          refreshErrors();
        }
      });
      return wrap;
    }

    function dropFields(prefix) {
      Object.keys(fields).forEach(function (key) {
        if (key.indexOf(prefix) === 0) {
          delete fields[key];
          delete touched[key];
        }
      });
    }

    function splitLines(text) {
      return text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    }

    function splitCommas(text) {
      var seen = {};
      return text.split(/[,;\n]/).map(function (part) { return part.trim(); }).filter(function (part) {
        var lower = part.toLowerCase();
        if (!part || seen[lower]) {
          return false;
        }
        seen[lower] = true;
        return true;
      });
    }

    /* ---------- sections ---------- */

    function section(name, title, open, hint) {
      var meta = el('span', { class: 'editor-section__meta' });
      var body = el('fieldset', { class: 'editor-section__body' }, [
        el('legend', { class: 'visually-hidden', text: title })
      ]);
      var details = el('details', { class: 'editor-section', id: 'section-' + name }, [
        el('summary', { class: 'editor-section__summary' }, [
          el('h2', { class: 'editor-section__title', text: title }),
          meta,
          el('span', { class: 'editor-section__chevron', 'aria-hidden': 'true' })
        ]),
        body
      ]);
      if (open) {
        details.open = true;
      }
      if (hint) {
        body.appendChild(el('p', { class: 'editor-section__hint', text: hint }));
      }
      sections[name] = { details: details, meta: meta, body: body };
      return sections[name];
    }

    function buildPersonal() {
      var s = section('personal', 'Personal information', true,
        'Only your name and email are required. Leave anything else blank.');
      var p = resume.personal;
      function set(name) { return function (value) { p[name] = value; }; }

      s.body.appendChild(el('div', { class: 'field-grid' }, [
        field({ key: 'personal.fullName', label: 'Full name', value: p.fullName, required: true,
          maxlength: L.name, autocomplete: 'name', placeholder: 'e.g. Amina Rahman', onInput: set('fullName') }),
        field({ key: 'personal.jobTitle', label: 'Professional title', value: p.jobTitle,
          maxlength: L.short, autocomplete: 'organization-title', placeholder: 'e.g. Product Designer', onInput: set('jobTitle') }),
        field({ key: 'personal.email', label: 'Email', value: p.email, required: true, type: 'email',
          maxlength: L.email, autocomplete: 'email', inputmode: 'email', spellcheck: false,
          placeholder: 'name@example.com', onInput: set('email') }),
        field({ key: 'personal.phone', label: 'Phone', value: p.phone, type: 'tel',
          maxlength: L.phone, autocomplete: 'tel', inputmode: 'tel', placeholder: '+44 20 7946 0958', onInput: set('phone') }),
        field({ key: 'personal.location', label: 'City, country', value: p.location,
          maxlength: L.short, autocomplete: 'address-level2', placeholder: 'e.g. Lahore, Pakistan', onInput: set('location') }),
        field({ key: 'personal.linkedin', label: 'LinkedIn URL', value: p.linkedin, type: 'text',
          maxlength: L.url, autocomplete: 'url', inputmode: 'url', spellcheck: false,
          placeholder: 'linkedin.com/in/your-name', onInput: set('linkedin') }),
        field({ key: 'personal.website', label: 'Portfolio or website URL', value: p.website, type: 'text',
          maxlength: L.url, autocomplete: 'url', inputmode: 'url', spellcheck: false, wide: true,
          placeholder: 'yourname.com', onInput: set('website') })
      ]));
      return s;
    }

    function buildSummary() {
      var s = section('summary', 'Professional summary', true);
      s.body.appendChild(el('div', { class: 'field-grid' }, [
        field({ key: 'summary', label: 'Summary', value: resume.summary, textarea: true, rows: 5,
          maxlength: L.summary, wide: true,
          hint: 'Two to four sentences about who you are and what you do best.',
          placeholder: 'Describe your experience, strengths and goals.',
          onInput: function (value) { resume.summary = value; } })
      ]));
      return s;
    }

    /* ----- repeated entries ----- */

    function entryTitle(type, entry, index) {
      var noun = LISTS[type].noun;
      var label = noun.charAt(0).toUpperCase() + noun.slice(1) + ' ' + (index + 1);
      var detail = '';
      if (type === 'experience') {
        detail = [entry.role, entry.company].filter(Boolean).join(' at ');
      } else if (type === 'education') {
        detail = [entry.degree, entry.school].filter(Boolean).join(', ');
      } else {
        detail = entry.name || '';
      }
      return detail ? label + ': ' + detail : label;
    }

    function entryFields(type, entry) {
      var k = type + '.' + entry.id + '.';
      function set(name) { return function (value) { entry[name] = value; }; }
      var list;

      if (type === 'experience') {
        var endField = field({ key: k + 'end', label: 'End date', value: entry.current ? '' : entry.end,
          maxlength: 20, placeholder: entry.current ? 'Present' : 'e.g. Aug 2024',
          hint: 'Month and year, or just the year.', onInput: set('end') });
        var endInput = fields[k + 'end'].input;
        endInput.disabled = !!entry.current;

        var currentBox = el('input', { type: 'checkbox', id: fieldId(k + 'current'), class: 'check__input' });
        currentBox.checked = !!entry.current;
        currentBox.addEventListener('change', function () {
          entry.current = currentBox.checked;
          endInput.disabled = entry.current;
          endInput.placeholder = entry.current ? 'Present' : 'e.g. Aug 2024';
          if (entry.current) {
            endInput.value = '';
            entry.end = '';
          }
          changed();
        });

        list = [
          field({ key: k + 'role', label: 'Job title', value: entry.role, required: true, maxlength: L.short,
            placeholder: 'e.g. Senior Designer', onInput: set('role') }),
          field({ key: k + 'company', label: 'Company', value: entry.company, required: true, maxlength: L.short,
            placeholder: 'e.g. Northwind Studio', onInput: set('company') }),
          field({ key: k + 'location', label: 'Location', value: entry.location, maxlength: L.short,
            placeholder: 'City, country or Remote', onInput: set('location') }),
          field({ key: k + 'start', label: 'Start date', value: entry.start, maxlength: 20,
            placeholder: 'e.g. Jun 2022', hint: 'Month and year, or just the year.', onInput: set('start') }),
          endField,
          el('div', { class: 'field' }, [
            el('label', { class: 'check', for: fieldId(k + 'current') }, [
              currentBox,
              el('span', { text: 'I currently work here' })
            ])
          ]),
          field({ key: k + 'highlights', label: 'Description', value: entry.highlights.join('\n'), textarea: true,
            rows: 5, maxlength: L.text, wide: true,
            hint: 'One achievement or responsibility per line.',
            placeholder: 'Led a team of five designers\nCut onboarding time by 30%',
            onInput: function (value) { entry.highlights = splitLines(value); } })
        ];
      } else if (type === 'education') {
        list = [
          field({ key: k + 'school', label: 'Institution', value: entry.school, required: true, maxlength: L.short,
            placeholder: 'e.g. Thal University', onInput: set('school') }),
          field({ key: k + 'degree', label: 'Qualification', value: entry.degree, required: true, maxlength: L.short,
            placeholder: 'e.g. BS, MBA, Diploma', onInput: set('degree') }),
          field({ key: k + 'field', label: 'Field of study', value: entry.field, maxlength: L.short,
            placeholder: 'e.g. Computer Science', onInput: set('field') }),
          field({ key: k + 'location', label: 'Location', value: entry.location, maxlength: L.short,
            placeholder: 'City, country', onInput: set('location') }),
          field({ key: k + 'start', label: 'Start date', value: entry.start, maxlength: 20,
            placeholder: 'e.g. Aug 2024', onInput: set('start') }),
          field({ key: k + 'end', label: 'End date', value: entry.end, maxlength: 20,
            placeholder: 'e.g. Jun 2028 or Present', onInput: set('end') }),
          field({ key: k + 'details', label: 'Description', value: entry.details, textarea: true, rows: 3,
            maxlength: L.text, wide: true, hint: 'Honours, thesis, activities (optional).',
            onInput: set('details') }),
          field({ key: k + 'coursework', label: 'Relevant coursework', value: entry.coursework.join(', '),
            maxlength: L.text, wide: true, hint: 'Separate with commas (optional).',
            onInput: function (value) { entry.coursework = splitCommas(value); } })
        ];
      } else if (type === 'projects') {
        list = [
          field({ key: k + 'name', label: 'Project name', value: entry.name, required: true, maxlength: L.short,
            placeholder: 'e.g. Portfolio website', onInput: set('name') }),
          field({ key: k + 'link', label: 'Project URL', value: entry.link, maxlength: L.url,
            inputmode: 'url', spellcheck: false, placeholder: 'github.com/you/project', onInput: set('link') }),
          field({ key: k + 'technologies', label: 'Technologies', value: entry.technologies.join(', '),
            maxlength: L.text, wide: true, hint: 'Separate with commas, e.g. HTML, CSS, JavaScript.',
            onInput: function (value) { entry.technologies = splitCommas(value); } }),
          field({ key: k + 'description', label: 'Description', value: entry.description, textarea: true,
            rows: 3, maxlength: L.text, wide: true, onInput: set('description') })
        ];
      } else if (type === 'certifications') {
        list = [
          field({ key: k + 'name', label: 'Certification name', value: entry.name, required: true,
            maxlength: L.short, placeholder: 'e.g. Responsive Web Design', onInput: set('name') }),
          field({ key: k + 'issuer', label: 'Issuing organization', value: entry.issuer, maxlength: L.short,
            placeholder: 'e.g. freeCodeCamp', onInput: set('issuer') }),
          field({ key: k + 'date', label: 'Issue date', value: entry.date, maxlength: 20,
            placeholder: 'e.g. Mar 2025', hint: 'Month and year, or just the year.', onInput: set('date') }),
          field({ key: k + 'url', label: 'Credential URL', value: entry.url, maxlength: L.url,
            inputmode: 'url', spellcheck: false, placeholder: 'example.com/verify/123', onInput: set('url') })
        ];
      } else {
        list = [
          field({ key: k + 'name', label: 'Language', value: entry.name, required: true, maxlength: L.short,
            placeholder: 'e.g. Urdu', onInput: set('name') }),
          field({ key: k + 'level', label: 'Proficiency', value: entry.level, select: [''].concat(LEVELS),
            onInput: set('level') })
        ];
      }
      return el('div', { class: 'field-grid' }, list);
    }

    function buildEntry(type, entry, index) {
      var title = el('legend', { class: 'entry__title', text: entryTitle(type, entry, index) });
      var remove = el('button', { type: 'button', class: 'btn btn--ghost btn--sm entry__remove', text: 'Remove' });
      remove.setAttribute('aria-label', 'Remove ' + entryTitle(type, entry, index));
      remove.addEventListener('click', function () { removeEntry(type, entry.id); });

      var node = el('li', { class: 'entry', 'data-entry-id': entry.id }, [
        el('fieldset', { class: 'entry__fields' }, [title, remove, entryFields(type, entry)])
      ]);
      return node;
    }

    function retitle(type) {
      var nodes = listNodes[type].children;
      resume[type].forEach(function (entry, index) {
        var node = nodes[index];
        if (!node) {
          return;
        }
        var text = entryTitle(type, entry, index);
        node.querySelector('.entry__title').textContent = text;
        node.querySelector('.entry__remove').setAttribute('aria-label', 'Remove ' + text);
      });
    }

    function updateEmpty(type) {
      var empty = sections[type].body.querySelector('.empty-state');
      if (empty) {
        empty.hidden = resume[type].length > 0;
      }
    }

    function buildList(type) {
      var def = LISTS[type];
      var s = section(type, def.title, type === 'experience');
      var ol = el('ol', { class: 'entry-list', role: 'list' });
      listNodes[type] = ol;

      resume[type].forEach(function (entry, index) {
        ol.appendChild(buildEntry(type, entry, index));
      });

      var addButton = el('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: def.add });
      addButton.addEventListener('click', function () { addEntry(type); });

      s.body.appendChild(el('p', { class: 'empty-state', text: def.empty, hidden: resume[type].length > 0 }));
      s.body.appendChild(ol);
      s.body.appendChild(el('div', { class: 'editor-section__actions' }, [addButton]));
      return s;
    }

    function addEntry(type) {
      var entry = Data[{ experience: 'createExperience', education: 'createEducation', projects: 'createProject',
        certifications: 'createCertification', languages: 'createLanguage' }[type]]();
      resume[type].push(entry);
      var node = buildEntry(type, entry, resume[type].length - 1);
      listNodes[type].appendChild(node);
      updateEmpty(type);
      sections[type].details.open = true;
      changed();
      var first = node.querySelector('input, textarea, select');
      if (first) {
        first.focus();
      }
      announce(LISTS[type].noun + ' added. ' + resume[type].length + ' in total.');
    }

    function removeEntry(type, id) {
      var index = -1;
      resume[type].forEach(function (entry, i) { if (entry.id === id) { index = i; } });
      if (index === -1) {
        return;
      }
      var removed = resume[type][index];
      var label = entryTitle(type, removed, index);
      var node = listNodes[type].children[index];

      resume[type].splice(index, 1);
      dropFields(type + '.' + id + '.');
      node.parentNode.removeChild(node);
      retitle(type);
      updateEmpty(type);
      changed();

      showUndo({ type: type, entry: removed, index: index, label: label });

      /* Keep keyboard focus somewhere sensible. */
      var next = listNodes[type].children[Math.min(index, resume[type].length - 1)];
      var target = next ? next.querySelector('.entry__remove') : sections[type].body.querySelector('.editor-section__actions .btn');
      if (target) {
        target.focus();
      }
    }

    /* ---------- undo ---------- */

    function hideUndo() {
      window.clearTimeout(undoTimer);
      undoState = null;
      if (undoBar) {
        undoBar.hidden = true;
      }
    }

    function showUndo(state) {
      undoState = state;
      window.clearTimeout(undoTimer);
      clear(undoBar);
      var button = el('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: 'Undo' });
      button.addEventListener('click', undoRemove);
      undoBar.appendChild(el('span', { class: 'undo-bar__text', text: state.label + ' removed.' }));
      undoBar.appendChild(button);
      undoBar.hidden = false;
      undoTimer = window.setTimeout(hideUndo, UNDO_MS);
    }

    function undoRemove() {
      var state = undoState;
      if (!state) {
        return;
      }
      hideUndo();
      var type = state.type;
      var index = Math.min(state.index, resume[type].length);
      var already = resume[type].some(function (entry) { return entry.id === state.entry.id; });
      if (already) {
        return;
      }
      resume[type].splice(index, 0, state.entry);
      var node = buildEntry(type, state.entry, index);
      var before = listNodes[type].children[index] || null;
      listNodes[type].insertBefore(node, before);
      retitle(type);
      updateEmpty(type);
      sections[type].details.open = true;
      changed();
      var first = node.querySelector('input, textarea, select');
      if (first) {
        first.focus();
      }
      announce(state.label + ' restored.');
    }

    /* ---------- skills (tag input) ---------- */

    function renderSkills() {
      clear(skillList);
      resume.skills.forEach(function (skill) {
        var remove = el('button', { type: 'button', class: 'skill-chip__remove', text: '×' });
        remove.setAttribute('aria-label', 'Remove skill ' + skill.name);
        remove.addEventListener('click', function () {
          resume.skills = resume.skills.filter(function (item) { return item.id !== skill.id; });
          renderSkills();
          changed();
          announce(skill.name + ' removed.');
          skillInput.focus();
        });
        skillList.appendChild(el('li', { class: 'skill-chip' }, [
          el('span', { class: 'skill-chip__name', text: skill.name }),
          remove
        ]));
      });
      var empty = sections.skills.body.querySelector('.empty-state');
      if (empty) {
        empty.hidden = resume.skills.length > 0;
      }
    }

    function addSkills(text) {
      var parts = splitCommas(text);
      var added = 0;
      var message = '';
      parts.forEach(function (name) {
        if (name.length > L.skill) {
          message = 'Skills can be up to ' + L.skill + ' characters. “' + name.slice(0, 12) + '…” was not added.';
          return;
        }
        if (resume.skills.length >= L.maxSkills) {
          message = 'You can add up to ' + L.maxSkills + ' skills.';
          return;
        }
        var exists = resume.skills.some(function (skill) {
          return skill.name.toLowerCase() === name.toLowerCase();
        });
        if (exists) {
          message = '“' + name + '” is already in your list.';
          return;
        }
        resume.skills.push(Data.createSkill(name));
        added += 1;
      });
      skillMessage.textContent = message;
      skillMessage.hidden = !message;
      if (added) {
        renderSkills();
        changed();
        announce(added + (added === 1 ? ' skill added.' : ' skills added.'));
      }
      return added;
    }

    function buildSkills() {
      var s = section('skills', 'Skills', true);
      skillList = el('ul', { class: 'chip-list', role: 'list', 'aria-label': 'Your skills' });
      skillMessage = el('p', { class: 'field__error', id: 'skill-message', hidden: true, role: 'status' });
      skillInput = el('input', {
        class: 'input', id: 'skill-input', type: 'text', maxlength: L.skill * 4, autocomplete: 'off',
        placeholder: 'e.g. Figma, JavaScript, Project management', 'aria-describedby': 'skill-hint skill-message'
      });
      var addButton = el('button', { type: 'button', class: 'btn btn--secondary', text: 'Add skill' });

      function commit() {
        if (skillInput.value.trim()) {
          if (addSkills(skillInput.value)) {
            skillInput.value = '';
          }
        }
        skillInput.focus();
      }
      addButton.addEventListener('click', commit);
      skillInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          commit();
        }
      });
      skillInput.addEventListener('paste', function (event) {
        var text = event.clipboardData ? event.clipboardData.getData('text') : '';
        if (/[,;\n]/.test(text)) {
          event.preventDefault();
          addSkills(text);
        }
      });

      s.body.appendChild(el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'skill-input', text: 'Add skills' }),
        el('div', { class: 'tag-input' }, [skillInput, addButton]),
        el('p', { class: 'field__hint', id: 'skill-hint', text: 'Press Enter or comma after each skill, or paste a comma-separated list.' }),
        skillMessage
      ]));
      s.body.appendChild(el('p', { class: 'empty-state', text: 'No skills added yet.', hidden: resume.skills.length > 0 }));
      s.body.appendChild(skillList);
      renderSkills();
      return s;
    }

    /* ---------- photo ---------- */

    /* Crops to a centred square and re-encodes as JPEG, trying smaller sizes
       and lower quality until the result fits Data.PHOTO_MAX_LENGTH. Only this
       re-encoded data URL is ever stored, never the original file. */
    function encodePhoto(image) {
      var side = Math.min(image.naturalWidth, image.naturalHeight);
      var attempts = [[PHOTO_SIZE, 0.85], [PHOTO_SIZE, 0.7], [300, 0.7], [240, 0.6], [200, 0.5]];
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      for (var i = 0; i < attempts.length; i += 1) {
        var size = attempts[i][0];
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2,
          side, side, 0, 0, size, size);
        var dataUrl = canvas.toDataURL('image/jpeg', attempts[i][1]);
        if (Data.isPhotoData(dataUrl)) {
          return dataUrl;
        }
      }
      return '';
    }

    function readPhoto(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error('read')); };
        reader.onload = function () {
          var image = new Image();
          image.onerror = function () { reject(new Error('decode')); };
          image.onload = function () {
            if (!image.naturalWidth || !image.naturalHeight) {
              reject(new Error('decode'));
              return;
            }
            var result = encodePhoto(image);
            if (result) {
              resolve(result);
            } else {
              reject(new Error('toolarge'));
            }
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function renderPhoto() {
      clear(photoBox.preview);
      var has = Data.isPhotoData(resume.personal.photo);
      if (has) {
        photoBox.preview.appendChild(el('img', {
          class: 'photo__img', src: resume.personal.photo, width: 96, height: 96, alt: 'Your profile photo'
        }));
      } else {
        photoBox.preview.appendChild(el('span', { class: 'photo__placeholder', 'aria-hidden': 'true', text: '+' }));
      }
      photoBox.remove.hidden = !has;
      photoBox.pick.textContent = has ? 'Change photo' : 'Choose photo';
    }

    function photoMessage(text) {
      photoBox.error.textContent = text;
      photoBox.error.hidden = !text;
    }

    function buildPhoto() {
      var s = section('photo', 'Profile photo (optional)', false);
      var input = el('input', { type: 'file', id: 'photo-input', 'aria-label': 'Choose a profile photo file', class: 'visually-hidden', accept: PHOTO_TYPES.join(','), tabindex: '-1' });
      var pick = el('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: 'Choose photo' });
      var remove = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Remove photo' });
      var error = el('p', { class: 'field__error', id: 'photo-error', hidden: true, role: 'status' });
      photoBox = { preview: el('div', { class: 'photo__preview' }), pick: pick, remove: remove, error: error };

      pick.addEventListener('click', function () { input.click(); });
      remove.addEventListener('click', function () {
        resume.personal.photo = '';
        renderPhoto();
        photoMessage('');
        changed();
        announce('Photo removed.');
        pick.focus();
      });
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        input.value = '';
        if (!file) {
          return;
        }
        if (PHOTO_TYPES.indexOf(file.type) === -1) {
          photoMessage('Choose a JPG, PNG or WebP image.');
          return;
        }
        if (file.size > PHOTO_MAX_BYTES) {
          photoMessage('That image is larger than 8 MB. Choose a smaller one.');
          return;
        }
        readPhoto(file).then(function (dataUrl) {
          resume.personal.photo = dataUrl;
          photoMessage('');
          renderPhoto();
          changed();
          announce('Photo added.');
        }, function (error) {
          photoMessage(error && error.message === 'toolarge'
            ? 'That image is too detailed to store. Try a smaller or simpler one.'
            : 'That image couldn’t be read. Try a different file.');
        });
      });

      s.body.appendChild(el('div', { class: 'photo' }, [
        photoBox.preview,
        el('div', { class: 'photo__controls' }, [
          el('p', { class: 'field__hint', id: 'photo-hint',
            text: 'JPG, PNG or WebP up to 8 MB. It is cropped to a square and shrunk to about 50 KB before it is saved in this browser; the original is never stored. Every template shows it except Compact ATS-Friendly, which stays photo-free.' }),
          el('div', { class: 'editor-section__actions' }, [pick, remove, input]),
          error
        ])
      ]));
      pick.setAttribute('aria-describedby', 'photo-hint photo-error');
      renderPhoto();
      return s;
    }

    /* ---------- section meta (counts) ---------- */

    function updateMeta() {
      sections.experience.meta.textContent = resume.experience.length
        ? resume.experience.length + (resume.experience.length === 1 ? ' role' : ' roles') : '';
      ['education', 'projects', 'certifications', 'languages'].forEach(function (type) {
        var n = resume[type].length;
        sections[type].meta.textContent = n ? n + (n === 1 ? ' entry' : ' entries') : '';
      });
      var s = resume.skills.length;
      sections.skills.meta.textContent = s ? s + (s === 1 ? ' skill' : ' skills') : '';
      sections.photo.meta.textContent = Data.isPhotoData(resume.personal.photo) ? 'Added' : '';
    }

    /* ---------- build / rebuild ---------- */

    function build() {
      clear(root);
      fields = {};
      touched = {};
      sections = {};
      listNodes = {};

      var order = [
        buildPersonal(), buildPhoto(), buildSummary(), buildList('experience'), buildList('education'),
        buildSkills(), buildList('projects'), buildList('certifications'), buildList('languages')
      ];
      order.forEach(function (s) { root.appendChild(s.details); });

      undoBar = el('div', { class: 'undo-bar', role: 'status', hidden: true });
      root.appendChild(undoBar);

      updateMeta();
      refreshErrors();
    }

    function setResume(next) {
      hideUndo();
      revealAll = false;
      resume = Data.migrateResume(next);
      build();
    }

    build();

    return {
      getResume: function () { return resume; },
      setResume: setResume,
      validate: validate,
      describeErrors: describeErrors,
      focusKey: focusKey,
      refreshErrors: refreshErrors
    };
  }

  LuxCV.EditorForm = { create: create, LEVELS: LEVELS };
})();
