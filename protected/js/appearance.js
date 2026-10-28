/* ==========================================================================
   LUXCV - appearance.js
   The "Template & appearance" panel in the editor: template picker, accent
   colour and text size. It holds no data of its own; it reads and writes
   through the callbacks it is given, so the builder stays the single owner of
   the resume.

     Appearance.create(host, {
       templates,            // Data.TEMPLATES
       getState(),           // → { templateId, settings }
       onTemplate(id),       // the user picked another template
       onSettings(settings)  // the user changed accent colour or text size
     }) → { sync() }
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var LIGHT_PAPER = '#ffffff';
  var DARK_PAPER = '#0e0f13'; /* Midnight Premium on screen */

  /* WCAG relative luminance and contrast ratio for #rrggbb colours. */
  function luminance(hex) {
    var channels = [1, 3, 5].map(function (i) {
      var value = parseInt(hex.slice(i, i + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrast(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function create(host, options) {
    var Data = LuxCV.Data;
    var el = LuxCV.Dom.el;

    var controls = {};
    var accentRadios = [];

    function state() {
      return options.getState();
    }

    /* ---------- template ---------- */

    var select = el('select', { class: 'select', id: 'appearance-template' }, options.templates.map(function (tpl) {
      return el('option', { value: tpl.id, text: tpl.name });
    }));
    var templateHint = el('p', { class: 'field__hint', id: 'appearance-template-hint' });
    select.setAttribute('aria-describedby', 'appearance-template-hint');
    select.addEventListener('change', function () {
      options.onTemplate(select.value);
    });

    /* ---------- accent colour ---------- */

    function emitSettings(patch) {
      options.onSettings(Object.assign({}, state().settings, patch));
    }

    function swatch(value, label, className) {
      var input = el('input', { type: 'radio', name: 'appearance-accent', class: 'swatch__input', value: value });
      var chip = el('span', { class: 'swatch__chip ' + (className || ''), 'aria-hidden': 'true' });
      if (value && Data.isValidAccent(value)) {
        chip.style.background = value;
      }
      input.addEventListener('change', function () {
        if (input.checked) {
          emitSettings({ accent: value });
        }
      });
      accentRadios.push(input);
      return el('label', { class: 'swatch', title: label }, [
        input, chip, el('span', { class: 'visually-hidden', text: label })
      ]);
    }

    var swatchRow = el('div', { class: 'swatches' }, [swatch('', 'Template default', 'swatch__chip--default')]
      .concat(Data.ACCENTS.map(function (accent) {
        return swatch(accent.value, accent.label);
      })));

    var customInput = el('input', { type: 'color', id: 'appearance-custom', class: 'swatch__custom', value: '#8c6a1f' });
    customInput.addEventListener('input', function () {
      emitSettings({ accent: customInput.value.toLowerCase() });
    });
    var customRow = el('div', { class: 'appearance__custom' }, [
      el('label', { class: 'field__label', for: 'appearance-custom', text: 'Custom colour' }),
      customInput
    ]);

    var accentNote = el('p', { class: 'field__hint', id: 'appearance-accent-note', role: 'status' });
    var accentSet = el('fieldset', { class: 'appearance__group' }, [
      el('legend', { class: 'field__label', text: 'Accent colour' }),
      swatchRow,
      customRow,
      accentNote
    ]);
    accentSet.setAttribute('aria-describedby', 'appearance-accent-note');

    /* ---------- text size ---------- */

    var sizeRadios = Data.FONT_SIZES.map(function (size) {
      var input = el('input', { type: 'radio', name: 'appearance-size', class: 'segment__input', value: size.id });
      input.addEventListener('change', function () {
        if (input.checked) {
          emitSettings({ fontSize: size.id });
        }
      });
      return { input: input, node: el('label', { class: 'segment' }, [input, el('span', { class: 'segment__text', text: size.label })]) };
    });
    var sizeSet = el('fieldset', { class: 'appearance__group' }, [
      el('legend', { class: 'field__label', text: 'Text size' }),
      el('div', { class: 'segments' }, sizeRadios.map(function (item) { return item.node; }))
    ]);

    var reset = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Reset appearance' });
    reset.addEventListener('click', function () {
      options.onSettings(Data.createSettings());
    });

    /* ---------- section shell ---------- */

    var body = el('fieldset', { class: 'editor-section__body' }, [
      el('legend', { class: 'visually-hidden', text: 'Template and appearance' }),
      el('div', { class: 'field-grid' }, [
        el('div', { class: 'field field--wide' }, [
          el('label', { class: 'field__label', for: 'appearance-template', text: 'Template' }),
          select,
          templateHint
        ])
      ]),
      accentSet,
      sizeSet,
      el('div', { class: 'editor-section__actions' }, [reset])
    ]);

    var details = el('details', { class: 'editor-section', id: 'section-appearance' }, [
      el('summary', { class: 'editor-section__summary' }, [
        el('h2', { class: 'editor-section__title', text: 'Template & appearance' }),
        el('span', { class: 'editor-section__meta', 'data-appearance-meta': '' }),
        el('span', { class: 'editor-section__chevron', 'aria-hidden': 'true' })
      ]),
      body
    ]);
    details.open = true;
    host.appendChild(details);

    controls.meta = details.querySelector('[data-appearance-meta]');

    /* ---------- sync with state ---------- */

    function sync() {
      var current = state();
      var tpl = Data.getTemplate(current.templateId);
      var settings = current.settings;
      var custom = settings.accent;
      var accentOn = !tpl || tpl.accent !== false;

      select.value = current.templateId;
      templateHint.textContent = tpl ? tpl.bestFor || tpl.description : '';
      controls.meta.textContent = tpl ? tpl.name : '';

      var matched = false;
      accentRadios.forEach(function (radio) {
        var on = radio.value === custom;
        radio.checked = on;
        radio.disabled = !accentOn;
        matched = matched || on;
      });
      customInput.disabled = !accentOn;
      if (custom) {
        customInput.value = custom;
      }
      customRow.classList.toggle('is-active', !!custom && !matched);

      sizeRadios.forEach(function (item) {
        item.input.checked = item.input.value === settings.fontSize;
      });

      var message = '';
      if (!accentOn) {
        message = tpl.name + ' stays black and white so applicant-tracking systems read it cleanly.';
      } else if (custom) {
        var paper = tpl && tpl.id === 'midnight-premium' ? DARK_PAPER : LIGHT_PAPER;
        if (contrast(custom, paper) < 3) {
          message = 'This colour may be hard to read on ' + (paper === DARK_PAPER ? 'a dark' : 'white') +
            ' page. Try a ' + (paper === DARK_PAPER ? 'lighter' : 'darker') + ' shade.';
        } else if (tpl && tpl.id === 'midnight-premium') {
          message = 'Printed copies use a darker shade of this colour automatically.';
        }
      }
      accentNote.textContent = message;
    }

    sync();
    return { sync: sync };
  }

  LuxCV.Appearance = { create: create, contrast: contrast };
})();
