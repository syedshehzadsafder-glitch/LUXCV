/* ==========================================================================
   LUXCV - template-renderer.js
   Turns resume data + a template id into an A4 resume, and wraps it in a
   scaled preview frame for the gallery, the builder and the print output.

   Rendering is DOM-based: every piece of user text is added with
   textContent, so entered markup is always shown as plain text and never
   runs. Web addresses become links only after validation.js accepts them.

   The renderer is driven by template metadata in data-model.js
   (sections.main / sections.side, headings, skillStyle, photo, accent).
   One shared structure is produced for every template; templates.css gives
   each its own design through --rs-* variables and .resume--{id} rules.

     <article class="resume-sheet resume--{id} rs-layout--single|split">
       <header class="rs-header">[photo] [monogram] name, title, contact</header>
       <div class="rs-body">
         <div class="rs-main">…sections…</div>
         <aside class="rs-aside">…sections…</aside>     (two-column only)
       </div>
     </article>

   Public API
     build(resume, templateId, options)   → <article> element
     render(resume, templateId, options)  → HTML string (compatibility)
     mount(container, resume, id, opts)   → replaces container content
     createPreview / setPreview / fit     → scaled, optionally multi-page frames
     hasContent(resume)                   → true once anything is entered
   options: { links, placeholders, printVersion }
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var DEFAULT_HEADINGS = {
    summary: 'Profile',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    projects: 'Projects',
    certifications: 'Certifications',
    languages: 'Languages',
    contact: 'Contact'
  };

  /* ---------- helpers ---------- */

  /* Kept for the gallery, which escapes its own template strings. */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function str(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function joinParts(parts, separator) {
    return parts.map(str).filter(Boolean).join(separator);
  }

  function dateRange(item) {
    var start = str(item.start);
    var end = item.current ? 'Present' : str(item.end);
    if (start && end) {
      return start === end ? start : start + ' – ' + end;
    }
    return start || end;
  }

  function initials(name) {
    var words = str(name).split(/\s+/).filter(Boolean);
    if (!words.length) {
      return '';
    }
    var last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
    return (words[0].charAt(0) + last).toUpperCase();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null && text !== '') {
      node.textContent = text;
    }
    return node;
  }

  function append(parent, children) {
    children.forEach(function (child) {
      if (child) {
        parent.appendChild(child);
      }
    });
    return parent;
  }

  /* "https://www.example.com/me/" → "example.com/me" for display. */
  function displayUrl(value) {
    return str(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
  }

  /* Returns a safe href for a web address or email, or '' when it is not
     valid. Only validated http(s) and mailto links are ever produced. */
  function safeHref(kind, value) {
    var V = LuxCV.Validation;
    var text = str(value);
    if (!V || !text) {
      return '';
    }
    if (kind === 'email') {
      return V.email(text) === '' ? 'mailto:' + encodeURI(text).replace(/\?/g, '%3F') : '';
    }
    return V.normalizeUrl(text);
  }

  /* A text node/span, or a link when options.links is on and the target is safe. */
  function textOrLink(text, href, options) {
    if (href && options.links) {
      var link = el('a', 'rs-link', text);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return link;
    }
    return document.createTextNode(text);
  }

  function bullets(items) {
    var clean = list(items).map(str).filter(Boolean);
    if (!clean.length) {
      return null;
    }
    var ul = el('ul', 'rs-bullets');
    clean.forEach(function (text) {
      ul.appendChild(el('li', '', text));
    });
    return ul;
  }

  function chips(items, extraClass) {
    var clean = list(items).map(str).filter(Boolean);
    if (!clean.length) {
      return null;
    }
    var ul = el('ul', 'rs-chips' + (extraClass ? ' ' + extraClass : ''));
    clean.forEach(function (text) {
      ul.appendChild(el('li', '', text));
    });
    return ul;
  }

  /* org may be a string or a node (for links). */
  function itemHead(title, org, date) {
    var main = el('div', 'rs-item__main');
    if (title) {
      main.appendChild(el('span', 'rs-item__title', title));
    }
    if (org) {
      var orgEl = el('span', 'rs-item__org');
      orgEl.appendChild(typeof org === 'string' ? document.createTextNode(org) : org);
      main.appendChild(orgEl);
    }
    var head = el('div', 'rs-item__head');
    head.appendChild(main);
    if (date) {
      head.appendChild(el('span', 'rs-item__date', date));
    }
    return head;
  }

  /* ---------- contact ---------- */

  /* [label, display text, href] for every contact detail that has a value. */
  function contactFields(personal) {
    var website = str(personal.website);
    var linkedin = str(personal.linkedin);
    return [
      ['Email', str(personal.email), safeHref('email', personal.email)],
      ['Phone', str(personal.phone), ''],
      ['Location', str(personal.location), ''],
      ['LinkedIn', displayUrl(linkedin), safeHref('url', linkedin)],
      ['Web', displayUrl(website), safeHref('url', website)]
    ].filter(function (field) {
      return field[1];
    });
  }

  function headerContact(personal, options) {
    var fields = contactFields(personal);
    if (!fields.length) {
      return null;
    }
    var ul = el('ul', 'rs-contact');
    fields.forEach(function (field) {
      var li = el('li');
      li.appendChild(textOrLink(field[1], field[2], options));
      ul.appendChild(li);
    });
    return ul;
  }

  function columnContact(resume, tpl, options) {
    var fields = contactFields(resume.personal || {});
    if (!fields.length) {
      return null;
    }
    var ul = el('ul', 'rs-contact-list');
    fields.forEach(function (field) {
      var value = el('span', 'rs-contact__value');
      value.appendChild(textOrLink(field[1], field[2], options));
      var li = el('li');
      append(li, [el('span', 'rs-contact__label', field[0]), value]);
      ul.appendChild(li);
    });
    return ul;
  }

  /* ---------- section bodies (return null when there is nothing to show) ---------- */

  function skillsBody(resume, tpl) {
    var skills = list(resume.skills).filter(function (skill) {
      return skill && str(skill.name);
    });
    if (!skills.length) {
      return null;
    }

    var style = tpl.skillStyle || 'chips';

    if (style === 'grouped') {
      var order = [];
      var groups = {};
      skills.forEach(function (skill) {
        var group = str(skill.group);
        if (!groups[group]) {
          groups[group] = [];
          order.push(group);
        }
        groups[group].push(skill.name);
      });
      var wrap = el('div', 'rs-skills rs-skills--grouped');
      order.forEach(function (group) {
        var box = el('div', 'rs-skillgroup');
        if (group) {
          box.appendChild(el('p', 'rs-skillgroup__name', group));
        }
        box.appendChild(chips(groups[group]));
        wrap.appendChild(box);
      });
      return wrap;
    }

    var ul = el('ul', 'rs-skills rs-skills--' + style);
    skills.forEach(function (skill) {
      ul.appendChild(el('li', '', str(skill.name)));
    });
    return ul;
  }

  var BODIES = {
    summary: function (resume) {
      var text = str(resume.summary);
      return text ? el('p', 'rs-text', text) : null;
    },

    experience: function (resume) {
      var frag = document.createDocumentFragment();
      list(resume.experience).forEach(function (job) {
        var title = str(job.role);
        var org = joinParts([job.company, job.location], ', ');
        if (!title && !org) {
          return;
        }
        frag.appendChild(append(el('article', 'rs-item'), [
          itemHead(title, org, dateRange(job)),
          bullets(job.highlights)
        ]));
      });
      return frag.childNodes.length ? frag : null;
    },

    education: function (resume) {
      var frag = document.createDocumentFragment();
      list(resume.education).forEach(function (entry) {
        var title = joinParts([entry.degree, entry.field], ' in ');
        var org = joinParts([entry.school, entry.location], ', ');
        if (!title && !org) {
          return;
        }
        var courses = list(entry.coursework).map(str).filter(Boolean);
        var courseBox = null;
        if (courses.length) {
          courseBox = append(el('div', 'rs-coursework'), [el('p', 'rs-coursework__label', 'Coursework'), chips(courses)]);
        }
        frag.appendChild(append(el('article', 'rs-item'), [
          itemHead(title, org, dateRange(entry)),
          str(entry.details) ? el('p', 'rs-item__details', str(entry.details)) : null,
          courseBox
        ]));
      });
      return frag.childNodes.length ? frag : null;
    },

    projects: function (resume, tpl, options) {
      var frag = document.createDocumentFragment();
      list(resume.projects).forEach(function (item) {
        var title = str(item.name);
        if (!title) {
          return;
        }
        var linkText = displayUrl(item.link);
        var org = linkText ? textOrLink(linkText, safeHref('url', item.link), options) : '';
        frag.appendChild(append(el('article', 'rs-item rs-project'), [
          itemHead(title, org, ''),
          str(item.description) ? el('p', 'rs-item__details', str(item.description)) : null,
          chips(item.technologies)
        ]));
      });
      return frag.childNodes.length ? frag : null;
    },

    certifications: function (resume, tpl, options) {
      var frag = document.createDocumentFragment();
      list(resume.certifications).forEach(function (cert) {
        var title = str(cert.name);
        if (!title) {
          return;
        }
        var urlText = displayUrl(cert.url);
        var detail = null;
        if (urlText) {
          detail = el('p', 'rs-item__details rs-cert__url');
          detail.appendChild(textOrLink(urlText, safeHref('url', cert.url), options));
        }
        frag.appendChild(append(el('article', 'rs-item rs-cert'), [
          itemHead(title, str(cert.issuer), str(cert.date)),
          detail
        ]));
      });
      return frag.childNodes.length ? frag : null;
    },

    languages: function (resume) {
      var items = list(resume.languages).filter(function (language) {
        return language && str(language.name);
      });
      if (!items.length) {
        return null;
      }
      var ul = el('ul', 'rs-languages');
      items.forEach(function (language) {
        var li = el('li');
        li.appendChild(el('span', 'rs-lang__name', str(language.name)));
        if (str(language.level)) {
          li.appendChild(el('span', 'rs-lang__level', str(language.level)));
        }
        ul.appendChild(li);
      });
      return ul;
    },

    skills: skillsBody,
    contact: columnContact
  };

  function renderSection(key, resume, tpl, options) {
    var body = BODIES[key] ? BODIES[key](resume, tpl, options) : null;
    if (!body) {
      return null;
    }
    var headings = tpl.headings || {};
    var label = headings[key] || DEFAULT_HEADINGS[key] || key;
    var heading = el('h3', 'rs-heading');
    heading.appendChild(el('span', '', label));
    var bodyEl = el('div', 'rs-section__body');
    bodyEl.appendChild(body);
    return append(el('section', 'rs-section rs-section--' + key), [heading, bodyEl]);
  }

  function renderSections(keys, resume, tpl, options) {
    var frag = document.createDocumentFragment();
    list(keys).forEach(function (key) {
      var section = renderSection(key, resume, tpl, options);
      if (section) {
        frag.appendChild(section);
      }
    });
    return frag;
  }

  function renderHeader(resume, tpl, options, showPhoto) {
    var personal = resume.personal || {};
    var sections = tpl.sections || {};
    var contactInColumn = list(sections.main).indexOf('contact') !== -1 ||
      list(sections.side).indexOf('contact') !== -1;

    /* Placeholders only while the resume is still empty; once the user has
       entered anything, a missing name or title is simply left out. */
    var name = str(personal.fullName) || (options.placeholders ? 'Your Name' : '');
    var title = str(personal.jobTitle) || (options.placeholders ? 'Professional Title' : '');

    var header = el('header', 'rs-header');
    if (showPhoto) {
      var photo = el('img', 'rs-photo');
      photo.alt = '';
      photo.src = personal.photo;
      header.appendChild(photo);
    }
    header.appendChild(el('span', 'rs-monogram', initials(personal.fullName) || 'YN'));
    header.lastChild.setAttribute('aria-hidden', 'true');

    var id = el('div', 'rs-header__id');
    append(id, [
      name ? el('h2', 'rs-name', name) : null,
      title ? el('p', 'rs-title', title) : null
    ]);
    header.appendChild(id);
    if (!contactInColumn) {
      append(header, [headerContact(personal, options)]);
    }
    return header;
  }

  /* ---------- public: content check ---------- */

  function hasContent(resume) {
    var Data = LuxCV.Data;
    var data = Data.normalizeResume(resume);
    var personal = data.personal || {};
    var anyPersonal = Object.keys(personal).some(function (key) {
      return typeof personal[key] === 'string' && personal[key].trim() !== '';
    });
    return anyPersonal || str(data.summary) !== '' || Data.LIST_TYPES.some(function (type) {
      return list(data[type]).some(Data.entryHasContent);
    });
  }

  /* ---------- public: build ---------- */

  function build(resume, templateId, opts) {
    var Data = LuxCV.Data;
    var tpl = Data.getTemplate(templateId) || Data.getTemplate(Data.DEFAULT_TEMPLATE_ID);
    var data = Data.normalizeResume(resume);
    var sections = tpl.sections || {};
    var settings = data.settings;
    var options = {
      links: !!(opts && opts.links),
      printVersion: !!(opts && opts.printVersion),
      placeholders: opts && opts.placeholders !== undefined ? !!opts.placeholders : !hasContent(data)
    };

    var mainKeys = list(sections.main);
    var sideKeys = list(sections.side);

    /* A section the user filled in must never vanish just because the chosen
       template does not list it. Any section with content that is missing from
       both columns is placed after the nearest earlier section in the main
       column (Certifications follow Education, even in a sidebar), or at the
       end of the main column. */
    var ORDER = ['summary', 'experience', 'education', 'projects', 'certifications', 'skills', 'languages'];
    ORDER.forEach(function (key, index) {
      if (mainKeys.indexOf(key) !== -1 || sideKeys.indexOf(key) !== -1) {
        return;
      }
      if (!BODIES[key](data, tpl, options)) {
        return;
      }
      var target = mainKeys;
      var at = mainKeys.length;
      for (var i = index - 1; i >= 0; i -= 1) {
        var inMain = mainKeys.indexOf(ORDER[i]);
        var inSide = sideKeys.indexOf(ORDER[i]);
        if (inMain !== -1) {
          at = inMain + 1;
          break;
        }
        if (inSide !== -1 && key === 'certifications') {
          target = sideKeys;
          at = inSide + 1;
          break;
        }
      }
      if (target === sideKeys) {
        sideKeys = sideKeys.slice();
        sideKeys.splice(at, 0, key);
      } else {
        mainKeys = mainKeys.slice();
        mainKeys.splice(at, 0, key);
      }
    });

    var layout = sideKeys.length ? 'split' : 'single';
    var showPhoto = tpl.photo !== false && Data.isPhotoData(data.personal.photo);

    var sheet = el('article', 'resume-sheet resume--' + tpl.id + ' rs-layout--' + layout +
      (showPhoto ? ' has-photo' : '') + (options.printVersion ? ' is-print-preview' : ''));
    sheet.setAttribute('data-template', tpl.id);

    var scale = Data.getFontScale(settings.fontSize);
    if (scale !== 1) {
      sheet.style.setProperty('--rs-scale', String(scale));
    }
    if (settings.accent && tpl.accent !== false) {
      sheet.setAttribute('data-custom-accent', '');
      sheet.style.setProperty('--rs-accent-custom', settings.accent);
    }

    var main = append(el('div', 'rs-main'), [renderSections(mainKeys, data, tpl, options)]);
    var body = el('div', 'rs-body');
    body.appendChild(main);
    if (sideKeys.length) {
      body.appendChild(append(el('aside', 'rs-aside'), [renderSections(sideKeys, data, tpl, options)]));
    }

    append(sheet, [renderHeader(data, tpl, options, showPhoto), body]);
    return sheet;
  }

  /* HTML string of the built sheet (every piece of user text is escaped by the DOM). */
  function render(resume, templateId, options) {
    return build(resume, templateId, options).outerHTML;
  }

  function mount(container, resume, templateId, options) {
    if (!container) {
      return false;
    }
    container.textContent = '';
    container.appendChild(build(resume, templateId, options));
    return true;
  }

  /* ---------- public: scaled preview frames ----------
     A frame keeps the A4 ratio at any width. The real-size sheet sits inside
     it and is shrunk with a CSS transform, so previews are the true design,
     not a separate thumbnail.

     options.flow = true makes a multi-page frame for the builder: the sheet
     may be taller than one page, its height is rounded up to whole pages,
     and dashed guides mark where each page ends. */

  var pageProbe = null;

  function pageHeightPx() {
    if (!pageProbe) {
      pageProbe = el('div');
      pageProbe.style.cssText = 'position:absolute;visibility:hidden;width:0;height:297mm;pointer-events:none';
    }
    if (!pageProbe.parentNode) {
      document.body.appendChild(pageProbe);
    }
    return pageProbe.offsetHeight || 1122.5;
  }

  var observer = 'ResizeObserver' in window
    ? new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        var target = entry.target;
        fit(target.classList.contains('sheet-preview') ? target : target.parentNode);
      });
    })
    : null;

  function fit(frame) {
    var scaler = frame && frame.firstElementChild;
    var sheet = scaler && scaler.querySelector('.resume-sheet');
    if (!sheet) {
      return;
    }
    var frameWidth = frame.clientWidth;
    var sheetWidth = sheet.offsetWidth;
    if (!frameWidth || !sheetWidth) {
      return; /* hidden (for example the Edit view on a phone); runs again when shown */
    }

    var flow = frame.classList.contains('sheet-preview--flow');
    if (flow) {
      var pages = paginate(sheet);
      if (frame.__pages !== pages) {
        frame.__pages = pages;
        frame.setAttribute('data-pages', String(pages));
        frame.dispatchEvent(new CustomEvent('preview:pages', { detail: { pages: pages } }));
      }
    }

    var scale = frameWidth / sheetWidth;
    frame.style.setProperty('--sheet-scale', scale.toFixed(5));
    if (flow) {
      frame.style.height = Math.ceil(scaler.offsetHeight * scale) + 'px';
    }
  }

  /* Rounds the sheet up to whole pages and draws the page-end guides.
     Safe to call repeatedly: the result only changes when the content does. */
  function paginate(sheet) {
    var pageH = pageHeightPx();
    Array.prototype.slice.call(sheet.querySelectorAll('.rs-pagebreak')).forEach(function (guide) {
      guide.parentNode.removeChild(guide);
    });
    sheet.style.minHeight = '';
    var pages = Math.max(1, Math.ceil((sheet.offsetHeight - 2) / pageH));
    sheet.style.minHeight = (pages * 297) + 'mm';
    for (var i = 1; i < pages; i += 1) {
      var guide = el('div', 'rs-pagebreak');
      guide.style.top = (i * 297) + 'mm';
      guide.setAttribute('aria-hidden', 'true');
      guide.appendChild(el('span', 'rs-pagebreak__label', 'Page ' + (i + 1)));
      sheet.appendChild(guide);
    }
    return pages;
  }

  /* Re-renders the frame. Returns { empty }; the page count is on
     frame.dataset.pages and announced by the "preview:pages" event. */
  function setPreview(frame, resume, templateId, options) {
    if (options) {
      frame.__options = options;
    }
    var scaler = frame.firstElementChild;
    scaler.textContent = '';
    scaler.appendChild(build(resume, templateId, frame.__options || {}));
    fit(frame);
    return { empty: !hasContent(resume) };
  }

  function createPreview(resume, templateId, options) {
    var frame = el('div', 'sheet-preview' + (options && options.flow ? ' sheet-preview--flow' : ''));
    frame.appendChild(el('div', 'sheet-preview__scaler'));
    setPreview(frame, resume, templateId, options || {});

    if (observer) {
      observer.observe(frame);
      if (options && options.flow) {
        observer.observe(frame.firstElementChild);
      }
    } else {
      window.addEventListener('resize', function () {
        fit(frame);
      });
    }
    return frame;
  }

  LuxCV.Renderer = {
    escapeHtml: escapeHtml,
    build: build,
    render: render,
    mount: mount,
    hasContent: hasContent,
    createPreview: createPreview,
    setPreview: setPreview,
    fit: fit
  };
})();
