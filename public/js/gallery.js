/* ==========================================================================
   LUXCV - gallery.js
   Controller for templates.html.
     - builds the category filters and the 10 template cards from the
       metadata in data-model.js (no hand-written card markup)
     - filters cards, keeping the choice in the URL (?category=…)
     - runs the preview modal (native <dialog>) with focus management
     - remembers the chosen template and passes it to the builder through
       ?template=…, with localStorage as a second route
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var doc = document;
  var root = doc.documentElement;

  var state = {
    category: 'all',
    currentId: null,
    printView: false
  };

  var els = {};

  function qs(selector, scope) {
    return (scope || doc).querySelector(selector);
  }

  function esc(value) {
    return LuxCV.Renderer.escapeHtml(value);
  }

  function builderUrl(id) {
    return 'builder.html?template=' + encodeURIComponent(id);
  }

  /* ---------- cards ---------- */

  function tagsFor(template) {
    var tags = template.tags.slice();
    if (template.categories.indexOf('ats') !== -1 && tags.indexOf('ATS-friendly') === -1) {
      tags.push('ATS-friendly');
    }
    return tags;
  }

  function buildCard(template) {
    var card = doc.createElement('article');
    card.className = 'template-card';
    card.setAttribute('data-template-id', template.id);
    card.setAttribute('data-categories', template.categories.join(' '));

    var preview = doc.createElement('div');
    preview.className = 'template-card__preview';
    preview.setAttribute('data-preview-trigger', template.id);
    preview.setAttribute('aria-hidden', 'true');
    preview.appendChild(LuxCV.Renderer.createPreview(LuxCV.Samples.get(template.id), template.id));
    card.appendChild(preview);

    var body = doc.createElement('div');
    body.className = 'template-card__body';
    body.innerHTML =
      '<h3 class="template-card__title">' + esc(template.name) + '</h3>' +
      '<p class="template-card__desc">' + esc(template.description) + '</p>' +
      '<ul class="template-card__tags" role="list">' + tagsFor(template).map(function (tag) {
        return '<li class="tag">' + esc(tag) + '</li>';
      }).join('') + '</ul>' +
      '<div class="template-card__actions">' +
        '<button class="btn btn--secondary btn--sm" type="button" data-action="preview" data-template-id="' + esc(template.id) + '">' +
          'Preview<span class="visually-hidden"> ' + esc(template.name) + ' template</span></button>' +
        '<a class="btn btn--primary btn--sm" href="' + builderUrl(template.id) + '" data-template-link="' + esc(template.id) + '">' +
          'Use Template<span class="visually-hidden"> ' + esc(template.name) + '</span></a>' +
      '</div>';
    card.appendChild(body);

    return card;
  }

  function renderCards() {
    var fragment = doc.createDocumentFragment();
    LuxCV.Data.TEMPLATES.forEach(function (template) {
      fragment.appendChild(buildCard(template));
    });
    els.grid.appendChild(fragment);
  }

  /* Marks the template the visitor chose last. */
  function updateSelectedBadge() {
    Array.prototype.forEach.call(doc.querySelectorAll('.template-card__badge'), function (badge) {
      badge.remove();
    });

    var stored = LuxCV.Storage.getStoredTemplate();
    var card = stored && qs('.template-card[data-template-id="' + stored + '"]');
    if (!card) {
      return;
    }

    var badge = doc.createElement('span');
    badge.className = 'tag tag--gold template-card__badge';
    badge.textContent = 'Selected';
    card.appendChild(badge);
  }

  /* ---------- filters ---------- */

  function renderFilters() {
    els.filterBar.innerHTML = LuxCV.Data.CATEGORIES.map(function (category) {
      return '<button class="chip" type="button" data-filter="' + esc(category.id) + '" aria-pressed="false">' +
        esc(category.label) + '</button>';
    }).join('');
  }

  function visibleCards() {
    return Array.prototype.filter.call(els.grid.children, function (card) {
      return !card.hidden;
    });
  }

  function visibleIds() {
    return visibleCards().map(function (card) {
      return card.getAttribute('data-template-id');
    });
  }

  function syncUrl() {
    try {
      var url = new URL(window.location.href);
      if (state.category === 'all') {
        url.searchParams.delete('category');
      } else {
        url.searchParams.set('category', state.category);
      }
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) {
      /* The URL is a convenience only; ignore environments that block it. */
    }
  }

  function applyFilter(categoryId, updateUrl) {
    var Data = LuxCV.Data;
    state.category = Data.isValidCategory(categoryId) ? categoryId : 'all';

    var matching = Data.getTemplatesByCategory(state.category).map(function (template) {
      return template.id;
    });

    Array.prototype.forEach.call(els.grid.children, function (card) {
      card.hidden = matching.indexOf(card.getAttribute('data-template-id')) === -1;
    });

    Array.prototype.forEach.call(els.filterBar.querySelectorAll('[data-filter]'), function (button) {
      var active = button.getAttribute('data-filter') === state.category;
      button.setAttribute('aria-pressed', String(active));
    });

    var total = Data.TEMPLATES.length;
    var label = '';
    Data.CATEGORIES.forEach(function (category) {
      if (category.id === state.category) {
        label = category.label;
      }
    });
    els.status.textContent = state.category === 'all'
      ? 'Showing all ' + total + ' templates'
      : 'Showing ' + matching.length + ' of ' + total + ' templates · ' + label;

    if (updateUrl) {
      syncUrl();
    }
  }

  /* ---------- preview modal ---------- */

  var nativeDialog = false;
  var pointerDownOnBackdrop = false;

  function setPrintView(on) {
    state.printView = on;
    var sheet = qs('.resume-sheet', els.stage);
    if (sheet) {
      sheet.classList.toggle('is-print-preview', on);
    }
    els.printToggle.setAttribute('aria-pressed', String(on));
    els.printToggle.textContent = on ? 'Show screen version' : 'Show print version';
  }

  function fillModal(id) {
    var Data = LuxCV.Data;
    var template = Data.getTemplate(id);
    if (!template) {
      return;
    }
    state.currentId = template.id;

    els.title.textContent = template.name;
    els.desc.textContent = template.description;
    els.bestFor.textContent = template.bestFor;
    els.tags.textContent = tagsFor(template).join(' · ');
    els.stage.setAttribute('aria-label',
      'Full-size preview of the ' + template.name + ' template, shown with sample content');

    LuxCV.Renderer.setPreview(els.stageFrame, LuxCV.Samples.get(template.id), template.id);

    els.printBlock.hidden = !template.printNote;
    els.printNote.textContent = template.printNote || '';
    setPrintView(false);

    els.useLink.setAttribute('href', builderUrl(template.id));
    els.useLink.setAttribute('data-template-link', template.id);
    els.useName.textContent = ' ' + template.name;

    var ids = visibleIds();
    var position = ids.indexOf(template.id) + 1;
    els.count.textContent = position + ' of ' + ids.length;
    Array.prototype.forEach.call(els.stepButtons, function (button) {
      button.disabled = ids.length < 2;
    });

    els.body.scrollTop = 0;
  }

  function openPreview(id) {
    if (!LuxCV.Data.getTemplate(id)) {
      return;
    }
    fillModal(id);

    if (!els.dialog.open) {
      if (nativeDialog) {
        els.dialog.showModal();
      } else {
        els.dialog.setAttribute('open', '');
      }
    }
    root.classList.add('is-modal-open');
    LuxCV.Renderer.fit(els.stageFrame);
    els.closeButton.focus();
  }

  function closePreview() {
    if (!els.dialog.open) {
      return;
    }
    if (typeof els.dialog.close === 'function') {
      els.dialog.close();
    } else {
      els.dialog.removeAttribute('open');
      afterClose();
    }
  }

  /* Runs for every way of closing: button, backdrop, Escape. Focus goes back
     to the Preview button of the template that was last shown. */
  function afterClose() {
    root.classList.remove('is-modal-open');

    var id = state.currentId;
    var target = id && qs('.template-card[data-template-id="' + id + '"]:not([hidden]) [data-action="preview"]');
    if (target) {
      target.focus();
    }
  }

  function stepPreview(direction) {
    var ids = visibleIds();
    if (ids.length < 2) {
      return;
    }
    var index = ids.indexOf(state.currentId);
    fillModal(ids[(index + direction + ids.length) % ids.length]);
  }

  function bindModal() {
    els.dialog.addEventListener('close', afterClose);

    /* Backdrop: a press and release that both land on the <dialog> itself
       (the panel covers everything else), so text selection that ends
       outside the panel does not close it. */
    els.dialog.addEventListener('pointerdown', function (event) {
      pointerDownOnBackdrop = event.target === els.dialog;
    });
    els.dialog.addEventListener('click', function (event) {
      if (event.target === els.dialog && pointerDownOnBackdrop) {
        closePreview();
      }
      pointerDownOnBackdrop = false;
    });

    /* Browsers without <dialog>.showModal() get Escape handled here. */
    if (!nativeDialog) {
      doc.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && els.dialog.open) {
          closePreview();
        }
      });
    }

    Array.prototype.forEach.call(els.dialog.querySelectorAll('[data-modal-close]'), function (button) {
      button.addEventListener('click', closePreview);
    });

    Array.prototype.forEach.call(els.stepButtons, function (button) {
      button.addEventListener('click', function () {
        stepPreview(parseInt(button.getAttribute('data-preview-step'), 10));
      });
    });

    els.printToggle.addEventListener('click', function () {
      setPrintView(!state.printView);
    });
  }

  /* ---------- events ---------- */

  function bindPage() {
    els.filterBar.addEventListener('click', function (event) {
      var button = event.target.closest('[data-filter]');
      if (button) {
        applyFilter(button.getAttribute('data-filter'), true);
      }
    });

    els.grid.addEventListener('click', function (event) {
      var button = event.target.closest('[data-action="preview"]');
      if (button) {
        openPreview(button.getAttribute('data-template-id'));
        return;
      }
      /* Mouse convenience: clicking the miniature opens the same preview.
         Keyboard and screen-reader users use the Preview button. */
      var thumb = event.target.closest('[data-preview-trigger]');
      if (thumb) {
        openPreview(thumb.getAttribute('data-preview-trigger'));
      }
    });

    /* Every "Use Template" link (cards and modal) remembers the choice, then
       follows its href, which already carries ?template=… */
    doc.addEventListener('click', function (event) {
      var link = event.target.closest('[data-template-link]');
      if (link) {
        LuxCV.Storage.setPreferredTemplate(link.getAttribute('data-template-link'));
      }
    });

    /* Back/forward cache: refresh the badge when the page is shown again. */
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) {
        updateSelectedBadge();
      }
    });
  }

  /* ---------- init ---------- */

  function init() {
    els.grid = qs('[data-gallery]');
    els.filterBar = qs('[data-filter-bar]');
    els.status = qs('[data-filter-status]');
    els.dialog = qs('#preview-modal');

    if (!els.grid || !els.filterBar || !els.dialog || !LuxCV.Data || !LuxCV.Samples || !LuxCV.Renderer) {
      return;
    }

    els.title = qs('[data-preview-title]', els.dialog);
    els.desc = qs('[data-preview-desc]', els.dialog);
    els.bestFor = qs('[data-preview-bestfor]', els.dialog);
    els.tags = qs('[data-preview-tags]', els.dialog);
    els.stage = qs('[data-preview-stage]', els.dialog);
    els.body = qs('.modal__body', els.dialog);
    els.printBlock = qs('[data-preview-print]', els.dialog);
    els.printNote = qs('[data-preview-printnote]', els.dialog);
    els.printToggle = qs('[data-print-toggle]', els.dialog);
    els.useLink = qs('[data-preview-use]', els.dialog);
    els.useName = qs('[data-preview-use-name]', els.dialog);
    els.count = qs('[data-preview-count]', els.dialog);
    els.closeButton = qs('.modal__close', els.dialog);
    els.stepButtons = els.dialog.querySelectorAll('[data-preview-step]');

    nativeDialog = typeof els.dialog.showModal === 'function';

    /* One reusable preview frame inside the modal. */
    els.stageFrame = LuxCV.Renderer.createPreview(LuxCV.Samples.get(LuxCV.Data.DEFAULT_TEMPLATE_ID), LuxCV.Data.DEFAULT_TEMPLATE_ID);
    els.stage.appendChild(els.stageFrame);

    renderFilters();
    renderCards();

    var requested = null;
    try {
      requested = new URLSearchParams(window.location.search).get('category');
    } catch (error) {
      requested = null;
    }
    applyFilter(requested, false);

    updateSelectedBadge();
    bindPage();
    bindModal();
  }

  LuxCV.Gallery = { init: init };
})();
