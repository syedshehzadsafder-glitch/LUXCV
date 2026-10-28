/* ==========================================================================
   LUXCV - builder.js
   Controller for builder.html (the resume editor).

   • Resolves the chosen template: ?template=… → saved choice → default, and
     keeps it in the address bar and in the saved preferences, so the gallery
     and a later visit remember it.
   • Loads the saved draft (cleaned by Data.migrateResume), creates the editing
     form and the appearance panel, and autosaves changes to localStorage.
   • Live preview: every change in the form, the template picker or the
     appearance settings re-renders the real template on the next animation
     frame. Switching templates only changes the design; the data is untouched.
   • Toolbar: Save Draft, Load Saved Resume, Preview (full-size dialog on
     desktop, Edit/Preview switch on small screens), Clear, Print Resume and
     Save as PDF.
   • Saving never overwrites a newer copy silently: each tab remembers the
     revision it loaded or saved, and a different stored revision (another tab
     or window) pauses autosave and asks which copy to keep.
   • Print / Save as PDF validate first, then print the real renderer output.
     The browser's print window creates the PDF; this page can't tell whether
     the person saved, so it never claims a file was downloaded.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var DESKTOP_QUERY = '(min-width: 64em)';
  var AUTOSAVE_MS = 700;
  var PREVIEW_OPTIONS = { flow: true, links: true };

  var state = {
    resume: null,
    form: null,
    appearance: null,
    frame: null,
    templateId: '',
    dirty: false,
    printVersion: false,
    baseRev: '',      /* revision of the saved copy this tab last loaded or saved */
    conflict: false,  /* the saved copy changed elsewhere; autosave is paused */
    printing: false
  };
  var nodes = {};
  var autosave = null;
  var renderQueued = 0;

  /* ---------- template choice ---------- */

  function requestedTemplate() {
    try {
      return new URLSearchParams(window.location.search).get('template');
    } catch (error) {
      return null;
    }
  }

  function resolveTemplateId() {
    var Data = LuxCV.Data;
    var Storage = LuxCV.Storage;

    var fromUrl = Data.resolveTemplateId(requestedTemplate());
    if (fromUrl) {
      Storage.setPreferredTemplate(fromUrl);
      return fromUrl;
    }
    return Storage.getStoredTemplate() || Data.DEFAULT_TEMPLATE_ID;
  }

  function syncUrl(id) {
    if (requestedTemplate() === id) {
      return;
    }
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('template', id);
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) {
      /* Blocked on some file:// pages; storage still carries the choice. */
    }
  }

  /* ---------- small helpers ---------- */

  function announce(text) {
    if (!nodes.status) {
      return;
    }
    /* Clearing first makes screen readers repeat an identical message. */
    nodes.status.textContent = '';
    window.setTimeout(function () { nodes.status.textContent = text; }, 30);
  }

  function formatTime(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  /* ---------- notices (storage and print messages) ---------- */

  function hideNotice() {
    if (nodes.notice) {
      nodes.notice.hidden = true;
      nodes.notice.removeAttribute('data-kind');
      LuxCV.Dom.clear(nodes.notice);
    }
  }

  /* kind: 'error' | 'info' | 'success'. actions: [{label, run}]. Errors use
     role="alert" so they are announced at once; the rest are polite. */
  function showNotice(kind, text, actions, focus) {
    var el = LuxCV.Dom.el;
    var box = nodes.notice;
    LuxCV.Dom.clear(box);
    box.className = 'alert alert--' + (kind === 'error' ? 'error' : kind === 'success' ? 'success' : 'info');
    box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    box.setAttribute('data-kind', kind);
    box.appendChild(el('p', { class: 'alert__text', text: text }));

    var buttons = (actions || []).concat([{ label: 'Dismiss', run: hideNotice, ghost: true }]);
    box.appendChild(el('div', { class: 'alert__actions' }, buttons.map(function (action) {
      var button = el('button', {
        type: 'button',
        class: 'btn btn--sm ' + (action.ghost ? 'btn--ghost' : 'btn--secondary'),
        text: action.label
      });
      button.addEventListener('click', function () { action.run(); });
      return button;
    })));
    box.hidden = false;
    if (focus) {
      setView('edit');
      box.focus();
      if (box.scrollIntoView) {
        box.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function setSaveStatus(text, kind) {
    nodes.saveStatus.textContent = text;
    nodes.saveStatus.setAttribute('data-state', kind || '');
  }

  function isDesktop() {
    return window.matchMedia(DESKTOP_QUERY).matches;
  }

  /* ---------- live preview ---------- */

  function previewOptions() {
    return {
      flow: PREVIEW_OPTIONS.flow,
      links: PREVIEW_OPTIONS.links,
      printVersion: state.printVersion && state.templateId === 'midnight-premium'
    };
  }

  function updatePagesLabel(empty) {
    var pages = Number(state.frame.getAttribute('data-pages')) || 1;
    var text = '';
    if (!empty) {
      text = pages === 1 ? 'Fits on 1 page' : 'About ' + pages + ' pages';
    }
    if (nodes.pages.textContent !== text) {
      nodes.pages.textContent = text;
    }
    nodes.pages.setAttribute('data-long', pages > 1 ? 'true' : 'false');
  }

  function renderPreview() {
    renderQueued = 0;
    if (!state.frame) {
      return;
    }
    var info = LuxCV.Renderer.setPreview(state.frame, state.resume, state.templateId, previewOptions());
    nodes.empty.hidden = !info.empty;
    state.frame.classList.toggle('is-empty', info.empty);
    updatePagesLabel(info.empty);
  }

  /* Re-render on the next frame so fast typing never queues up extra work. */
  function scheduleRender() {
    if (!renderQueued) {
      renderQueued = window.requestAnimationFrame(renderPreview);
    }
  }

  function updatePrintVersionButton() {
    var isMidnight = state.templateId === 'midnight-premium';
    nodes.printVersion.hidden = !isMidnight;
    nodes.printVersion.setAttribute('aria-pressed', String(state.printVersion));
    nodes.printVersion.textContent = state.printVersion ? 'Show dark version' : 'Show print version';
  }

  /* ---------- changes ---------- */

  function onChange(resume) {
    state.resume = resume;
    state.dirty = true;
    setSaveStatus('Unsaved changes…', 'dirty');
    autosave();
    scheduleRender();
  }

  /* Switches the design only: the resume content is never touched. */
  function setTemplate(id, options) {
    var Data = LuxCV.Data;
    var template = Data.getTemplate(id);
    if (!template) {
      return;
    }
    var quiet = options && options.quiet;

    state.templateId = template.id;
    state.resume.templateId = template.id;
    LuxCV.Storage.setPreferredTemplate(template.id);
    syncUrl(template.id);

    var tag = document.querySelector('[data-selected-template]');
    if (tag) {
      tag.textContent = template.name;
    }
    if (state.appearance) {
      state.appearance.sync();
    }
    updatePrintVersionButton();

    if (!quiet) {
      renderPreview();
      onChange(state.resume);
      announce(template.name + ' template applied. Your details are unchanged.');
    }
  }

  function setSettings(settings) {
    state.resume.settings = LuxCV.Data.cleanSettings(settings);
    state.appearance.sync();
    onChange(state.resume);
    renderPreview();
  }

  /* ---------- saving ---------- */

  function timeLabel(iso) {
    var time = formatTime(iso);
    return time ? ' at ' + time : '';
  }

  function hasPhoto() {
    return LuxCV.Data.isPhotoData(state.resume.personal && state.resume.personal.photo);
  }

  /* Explains a failed save. Automatic saves only update the notice when the
     problem changes, so a screen reader isn't flooded while the user types. */
  function reportSaveFailure(status, reason) {
    var manual = reason === 'manual';
    var already = nodes.notice.getAttribute('data-problem');

    if (status === 'conflict') {
      state.conflict = true;
      autosave.flush();
      setSaveStatus('Newer saved copy found, not saved', 'error');
      showConflict(manual);
      return;
    }

    var text;
    if (status === 'quota') {
      text = 'Your browser’s storage is full, so this draft could not be saved. Your changes are still on this page.' +
        (hasPhoto() ? ' Removing the profile photo frees the most space.' : '') +
        ' You can also free up site data in your browser settings, or use Save as PDF to keep a copy.';
      setSaveStatus('Not saved: browser storage is full', 'error');
    } else {
      text = 'Saving is not available in this browser (private browsing or blocked site data). Your changes stay on this page only until you close it. Use Save as PDF to keep a copy.';
      setSaveStatus('Not saved: storage unavailable', 'error');
    }
    if (manual || already !== status) {
      showNotice('error', text, [], manual);
      nodes.notice.setAttribute('data-problem', status);
    }
    if (manual) {
      announce('Not saved. ' + text);
    }
  }

  function save(reason) {
    var Storage = LuxCV.Storage;
    if (state.conflict) {
      if (reason === 'manual') {
        showConflict(true);
      }
      return false;
    }
    state.resume.templateId = state.templateId;
    var result = Storage.saveDraftResult(state.resume, { baseRev: state.baseRev });
    if (result.ok) {
      state.baseRev = result.rev;
      state.dirty = false;
      setSaveStatus('Draft saved ' + formatTime(result.savedAt), 'saved');
      if (nodes.notice.getAttribute('data-problem')) {
        hideNotice();
        nodes.notice.removeAttribute('data-problem');
      }
      if (reason === 'manual') {
        announce('Draft saved' + timeLabel(result.savedAt) + '. It is stored in this browser only.');
      }
      return true;
    }
    reportSaveFailure(result.status, reason);
    return false;
  }

  function flushSave() {
    if (state.dirty) {
      autosave.flush();
      save('auto');
    }
  }

  /* ---------- loading a saved copy, conflicts ---------- */

  /* Puts a stored resume on the page, replacing the current content. */
  function applyDraft(draft) {
    var Data = LuxCV.Data;
    state.form.setResume(draft.resume);
    state.resume = state.form.getResume();
    var id = Data.resolveTemplateId(state.resume.templateId) || state.templateId;
    state.printVersion = false;
    setTemplate(id, { quiet: true });
    state.appearance.sync();
    renderPreview();
    hideSummary();
    state.baseRev = draft.rev;
    state.dirty = false;
    state.conflict = false;
    autosave.flush();
    setSaveStatus('Loaded · saved ' + formatTime(draft.savedAt), 'saved');
  }

  function removeUnreadable() {
    LuxCV.Storage.clearDraft();
    state.baseRev = '';
    hideNotice();
    nodes.notice.removeAttribute('data-problem');
    announce('The unreadable saved data was deleted.');
  }

  function loadSaved(opener) {
    var Storage = LuxCV.Storage;
    var Data = LuxCV.Data;
    var info = Storage.inspectDraft();

    if (info.status === 'unavailable') {
      showNotice('error', 'Saved resumes can’t be read in this browser (private browsing or blocked site data).', [], true);
      announce('Saved resumes can’t be read in this browser.');
      return;
    }
    if (info.status === 'none') {
      showNotice('info', 'There is no saved resume in this browser yet. Use Save Draft to store one.', [], true);
      announce('No saved resume found in this browser.');
      return;
    }
    if (info.status === 'corrupt') {
      showNotice('error', 'The saved resume could not be read because its data is damaged, so nothing was loaded. Your current page is unchanged.',
        [{ label: 'Delete the damaged data', run: removeUnreadable }], true);
      announce('The saved resume could not be read.');
      return;
    }

    var draft = info.draft;
    var incoming = Data.migrateResume(draft.resume);
    var same = JSON.stringify(incoming) === JSON.stringify(state.resume) && draft.rev === state.baseRev;
    if (same && !state.conflict) {
      showNotice('info', 'The saved resume is already what you see on the page.', [], false);
      announce('The saved resume is already on the page.');
      return;
    }

    var text = document.getElementById('load-dialog-text');
    text.textContent = state.dirty || state.conflict
      ? 'You have changes that are not saved. Loading replaces them with the copy saved' + timeLabel(draft.savedAt) + '. Unsaved changes will be lost.'
      : 'This replaces what is on the page with the copy saved' + timeLabel(draft.savedAt) + '.';

    LuxCV.Dialog.confirm(nodes.loadDialog, opener).then(function (confirmed) {
      if (!confirmed) {
        return;
      }
      /* Read again: the saved copy may have changed while the dialog was open. */
      var latest = Storage.inspectDraft();
      if (latest.status !== 'ok') {
        showNotice('error', 'The saved resume is no longer available, so nothing was loaded.', [], true);
        return;
      }
      applyDraft(latest.draft);
      hideNotice();
      nodes.notice.removeAttribute('data-problem');
      showNotice('success', 'Saved resume loaded' + timeLabel(latest.draft.savedAt) + '.', [], false);
      announce('Saved resume loaded.');
    });
  }

  /* Another tab or window saved or deleted the draft since this one loaded it. */
  function showConflict(focus) {
    var stored = LuxCV.Storage.inspectDraft();
    var gone = stored.status === 'none';
    var text;
    var actions;

    if (gone) {
      text = 'The saved copy of your resume was deleted in another tab or window. Autosave is paused so it isn’t recreated without you asking.';
      actions = [{ label: 'Save this page again', run: overwriteSaved }];
    } else {
      text = 'A different version of your resume was saved in another tab or window' +
        (stored.draft ? timeLabel(stored.draft.savedAt) : '') +
        '. Autosave is paused so it doesn’t overwrite it. Choose which version to keep.';
      actions = [
        { label: 'Load the saved version', run: function () { loadConflictCopy(); } },
        { label: 'Replace it with this page', run: overwriteSaved }
      ];
    }
    showNotice('error', text, actions, focus);
    nodes.notice.setAttribute('data-problem', 'conflict');
    if (!focus) {
      announce('Saving paused: a different version was saved in another tab.');
    }
  }

  function loadConflictCopy() {
    var info = LuxCV.Storage.inspectDraft();
    if (info.status !== 'ok') {
      showNotice('error', 'The saved version could not be read, so nothing was loaded.', [], true);
      return;
    }
    applyDraft(info.draft);
    hideNotice();
    nodes.notice.removeAttribute('data-problem');
    showNotice('success', 'The saved version was loaded. Your earlier edits on this page were replaced.', [], false);
    announce('The saved version was loaded.');
  }

  function overwriteSaved() {
    state.resume.templateId = state.templateId;
    var result = LuxCV.Storage.saveDraftResult(state.resume, { force: true });
    if (result.ok) {
      state.baseRev = result.rev;
      state.dirty = false;
      state.conflict = false;
      hideNotice();
      nodes.notice.removeAttribute('data-problem');
      setSaveStatus('Draft saved ' + formatTime(result.savedAt), 'saved');
      announce('The saved copy was replaced with this page.');
    } else {
      state.conflict = false;
      reportSaveFailure(result.status, 'manual');
    }
  }

  function onStorageEvent(event) {
    /* key === null means another tab cleared all of localStorage. */
    if (event.key !== null && event.key !== LuxCV.Storage.KEYS.RESUME) {
      return;
    }
    var current = LuxCV.Storage.storedRevision();
    var same = (current === null && state.baseRev === '') || current === state.baseRev;
    if (same) {
      return;
    }
    if (state.conflict) {
      showConflict(false); /* refresh the wording: the saved copy changed again */
      return;
    }
    state.conflict = true;
    autosave.flush();
    setSaveStatus('Saved copy changed in another tab', 'error');
    showConflict(false);
  }

  /* ---------- error summary ---------- */

  function hideSummary() {
    nodes.summary.hidden = true;
    LuxCV.Dom.clear(nodes.summary);
  }

  function showSummary(result) {
    var el = LuxCV.Dom.el;
    var items = state.form.describeErrors(result);
    LuxCV.Dom.clear(nodes.summary);

    var list = el('ul', { class: 'alert__list', role: 'list' }, items.map(function (item) {
      var button = el('button', { type: 'button', class: 'alert__link', text: item.label + ': ' + item.message });
      button.addEventListener('click', function () {
        setView('edit');
        state.form.focusKey(item.key);
      });
      return el('li', {}, [button]);
    }));

    nodes.summary.appendChild(el('p', { class: 'alert__title',
      text: result.count === 1 ? 'Please fix 1 issue before continuing.' : 'Please fix ' + result.count + ' issues before continuing.' }));
    nodes.summary.appendChild(list);
    nodes.summary.hidden = false;
    nodes.summary.focus();
    if (nodes.summary.scrollIntoView) {
      nodes.summary.scrollIntoView({ block: 'nearest' });
    }
  }

  /* Validates everything; returns true when the resume is OK to print. */
  function checkResume() {
    var result = state.form.validate(true);
    if (result.count) {
      setView('edit');
      showSummary(result);
      return false;
    }
    hideSummary();
    return true;
  }

  /* ---------- views and dialogs ---------- */

  function setView(view) {
    nodes.workspace.setAttribute('data-view', view);
    nodes.viewButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-view-button') === view));
    });
  }

  function openFullPreview(opener) {
    var stage = nodes.previewDialog.querySelector('[data-preview-stage]');
    var note = nodes.previewDialog.querySelector('[data-preview-note]');

    LuxCV.Dom.clear(stage);
    LuxCV.Dialog.open(nodes.previewDialog, opener);
    stage.appendChild(LuxCV.Renderer.createPreview(state.resume, state.templateId, previewOptions()));
    note.textContent = LuxCV.Renderer.hasContent(state.resume)
      ? 'Shown with your current details.'
      : 'Nothing entered yet. Placeholders show where your details will go.';
  }

  function onPreviewButton(button) {
    if (isDesktop()) {
      openFullPreview(button);
    } else {
      setView('preview');
      nodes.viewButtons[1].focus();
    }
  }

  /* ---------- printing and PDF ---------- */

  var restoreTitle = null;

  function mountPrintRoot() {
    LuxCV.Renderer.mount(nodes.printRoot, state.resume, state.templateId, { links: true });
  }

  /* Runs for every print, including Ctrl/Cmd+P and the browser menu, so a
     print never comes out blank. */
  function onBeforePrint() {
    if (!nodes.printRoot.firstChild) {
      mountPrintRoot();
    }
    if (!state.printing && !restoreTitle) {
      restoreTitle = LuxCV.PdfExport.applyTitle(state.resume);
    }
  }

  function onAfterPrint() {
    LuxCV.Dom.clear(nodes.printRoot);
    if (restoreTitle) {
      restoreTitle();
      restoreTitle = null;
    }
    if (state.printing) {
      var wasPdf = state.printing === 'pdf';
      state.printing = false;
      showNotice('info', wasPdf
        ? 'The print window closed. If you chose Save as PDF and pressed Save, your browser saved the file where you told it to. LUXCV can’t see whether that happened.'
        : 'The print window closed.', [], false);
    }
  }

  /* kind: 'print' or 'pdf'. Validates, then opens the print window. */
  function startPrint(kind) {
    if (!checkResume()) {
      announce('Fix the highlighted fields before ' + (kind === 'pdf' ? 'saving as PDF.' : 'printing.'));
      return;
    }
    if (!LuxCV.PdfExport.isSupported()) {
      showNotice('error', 'This browser can’t open a print window from the page. Use the browser menu’s Print command instead.', [], true);
      return;
    }
    flushSave();
    mountPrintRoot();
    state.printing = kind;
    hideNotice();
    announce('Opening the print window. Nothing has been saved or downloaded yet.');
    if (!LuxCV.PdfExport.print(state.resume)) {
      state.printing = false;
      LuxCV.Dom.clear(nodes.printRoot);
      showNotice('error', 'The browser didn’t open the print window. Check that pop-ups and printing aren’t blocked, then try again.', [], true);
    }
  }

  function printResume() {
    startPrint('print');
  }

  /* Save as PDF: explain the browser's print window first, so nobody expects
     an automatic download. */
  function savePdf(opener) {
    if (!checkResume()) {
      announce('Fix the highlighted fields before saving as PDF.');
      return;
    }
    LuxCV.Dialog.confirm(nodes.pdfDialog, opener).then(function (confirmed) {
      if (confirmed) {
        startPrint('pdf');
      }
    });
  }

  /* Download PDF: an image-based PDF made in the browser (pdf-download.js). */
  function downloadPdf(button) {
    if (!checkResume()) {
      announce('Fix the highlighted fields before downloading.');
      return;
    }
    if (!LuxCV.PdfDownload || !LuxCV.PdfDownload.isSupported()) {
      showNotice('error', 'This browser can’t create the PDF here. Use Save as PDF instead.', [], true);
      return;
    }
    flushSave();
    var label = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing PDF…';
    hideNotice();
    announce('Preparing your PDF. This can take a few seconds.');

    LuxCV.PdfDownload.download(state.resume, state.templateId).then(function (result) {
      showNotice('success', 'Your browser was asked to download ' + result.fileName + ' (' + result.pages +
        (result.pages === 1 ? ' page' : ' pages') + '). Text in this PDF is a picture, so it can’t be selected or read by applicant-tracking systems. For selectable text, use Save as PDF.', [], false);
      announce('PDF download started: ' + result.fileName + '.');
    }, function () {
      showNotice('error', 'The PDF could not be created. Your resume is unchanged. Try again, or use Save as PDF.', [], true);
      announce('The PDF could not be created.');
    }).then(function () {
      button.disabled = false;
      button.textContent = label;
    });
  }

  /* Printing and PDF export re-check the session with the server first, so an
     expired or deactivated account can't keep exporting from an open tab. */
  function guarded(run) {
    if (!LuxCV.Cloud) {
      run();
      return;
    }
    LuxCV.Cloud.guard().then(function (result) {
      if (result.ok) {
        run();
      } else if (result.reason === 'network') {
        showNotice('error', 'We couldn’t verify your session with the server, so nothing was exported. Check your connection and try again.', [], true);
      }
    });
  }

  /* ---------- clearing and deleting ---------- */

  function resetToEmpty() {
    autosave.flush();
    var fresh = LuxCV.Data.createEmptyResume();
    fresh.templateId = state.templateId;
    state.form.setResume(fresh);
    state.resume = state.form.getResume();
    state.dirty = false;
    state.conflict = false;
    state.baseRev = '';
    state.printVersion = false;
    updatePrintVersionButton();
    state.appearance.sync();
    renderPreview();
    hideSummary();
    hideNotice();
    nodes.notice.removeAttribute('data-problem');
  }

  function clearResume(opener) {
    LuxCV.Dialog.confirm(nodes.clearDialog, opener).then(function (confirmed) {
      if (!confirmed) {
        return;
      }
      var removed = LuxCV.Storage.clearDraft();
      resetToEmpty();
      setSaveStatus('Not saved yet', '');
      if (removed) {
        announce('Resume cleared. The saved draft was deleted from this browser.');
      } else {
        showNotice('error', 'The page was cleared, but this browser wouldn’t let LUXCV delete the saved draft. Clear the site data in your browser settings to remove it.', [], false);
        announce('Resume cleared, but the saved draft could not be deleted.');
      }
      focusName();
    });
  }

  function deleteAllData(opener) {
    LuxCV.Dialog.confirm(nodes.deleteDialog, opener).then(function (confirmed) {
      if (!confirmed) {
        return;
      }
      var removed = LuxCV.Storage.deleteAll();
      resetToEmpty();
      setSaveStatus('Not saved yet', '');
      if (removed) {
        showNotice('success', 'All saved LUXCV data was deleted from this browser.', [], false);
        announce('All saved data was deleted from this browser.');
      } else {
        showNotice('error', 'LUXCV could not delete its saved data because the browser blocked access. Clear this site’s data in your browser settings.', [], false);
        announce('Saved data could not be deleted.');
      }
    });
  }

  function focusName() {
    var first = document.getElementById('f-personal-fullName');
    if (first) {
      first.focus();
      first.scrollIntoView({ block: 'center' });
    }
  }

  /* ---------- init ---------- */

  function init() {
    var form = document.getElementById('resume-form');
    if (!form) {
      return;
    }

    nodes = {
      form: form,
      workspace: document.querySelector('[data-workspace]'),
      viewButtons: Array.prototype.slice.call(document.querySelectorAll('[data-view-button]')),
      status: document.getElementById('sr-status'),
      saveStatus: document.querySelector('[data-save-status]'),
      summary: document.getElementById('error-summary'),
      previewDialog: document.getElementById('preview-dialog'),
      clearDialog: document.getElementById('clear-dialog'),
      loadDialog: document.getElementById('load-dialog'),
      deleteDialog: document.getElementById('delete-dialog'),
      pdfDialog: document.getElementById('pdf-dialog'),
      notice: document.getElementById('notice'),
      printRoot: document.getElementById('print-root'),
      livePreview: document.querySelector('[data-live-preview]'),
      empty: document.querySelector('[data-preview-empty]'),
      pages: document.querySelector('[data-preview-pages]'),
      printVersion: document.querySelector('[data-action="print-version"]'),
      appearanceHost: document.querySelector('[data-appearance-host]')
    };

    var Data = LuxCV.Data;
    var templateId = resolveTemplateId();
    var template = Data.getTemplate(templateId);
    if (!template) {
      return;
    }

    var info = LuxCV.Storage.inspectDraft();
    var draft = info.draft;
    var resume = Data.migrateResume(draft ? draft.resume : null);
    state.baseRev = draft ? draft.rev : '';
    state.resume = resume;
    autosave = LuxCV.Dom.debounce(function () { save('auto'); }, AUTOSAVE_MS);

    state.form = LuxCV.EditorForm.create(form, { resume: resume, onChange: onChange, announce: announce });
    state.resume = state.form.getResume();

    state.appearance = LuxCV.Appearance.create(nodes.appearanceHost, {
      templates: Data.TEMPLATES,
      getState: function () {
        return { templateId: state.templateId, settings: state.resume.settings };
      },
      onTemplate: function (id) { setTemplate(id); },
      onSettings: setSettings
    });

    state.frame = LuxCV.Renderer.createPreview(state.resume, template.id, previewOptions());
    state.frame.addEventListener('preview:pages', function () {
      updatePagesLabel(nodes.empty ? !nodes.empty.hidden : false);
    });
    nodes.livePreview.appendChild(state.frame);

    setTemplate(template.id, { quiet: true });
    renderPreview();

    if (draft && draft.savedAt) {
      setSaveStatus('Draft restored · saved ' + formatTime(draft.savedAt), 'saved');
    } else {
      setSaveStatus('Not saved yet', '');
    }

    if (info.status === 'unavailable' || !LuxCV.Storage.isAvailable()) {
      setSaveStatus('Saving unavailable in this browser', 'error');
      showNotice('error', 'Saving is not available in this browser (private browsing or blocked site data). You can still edit, but your resume stays on this page only until you close it. Use Save as PDF to keep a copy.', [], false);
      nodes.notice.setAttribute('data-problem', 'unavailable');
    } else if (info.status === 'corrupt') {
      showNotice('error', 'A saved resume was found but its data is damaged, so it was ignored. Your next save replaces it.',
        [{ label: 'Delete the damaged data now', run: removeUnreadable }], false);
      nodes.notice.setAttribute('data-problem', 'corrupt');
    }

    LuxCV.Dialog.setup(nodes.previewDialog);
    LuxCV.Dialog.setup(nodes.clearDialog);
    LuxCV.Dialog.setup(nodes.loadDialog);
    LuxCV.Dialog.setup(nodes.deleteDialog);
    LuxCV.Dialog.setup(nodes.pdfDialog);

    nodes.viewButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setView(button.getAttribute('data-view-button'));
      });
    });

    document.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!button) {
        return;
      }
      var action = button.getAttribute('data-action');
      if (action === 'save') {
        save('manual');
      } else if (action === 'preview') {
        onPreviewButton(button);
      } else if (action === 'preview-full') {
        openFullPreview(button);
      } else if (action === 'load') {
        loadSaved(button);
      } else if (action === 'pdf') {
        guarded(function () { savePdf(button); });
      } else if (action === 'download-pdf') {
        guarded(function () { downloadPdf(button); });
      } else if (action === 'delete-data') {
        deleteAllData(button);
      } else if (action === 'print') {
        guarded(printResume);
      } else if (action === 'clear') {
        clearResume(button);
      } else if (action === 'print-version') {
        state.printVersion = !state.printVersion;
        updatePrintVersionButton();
        renderPreview();
      } else if (action === 'focus-name') {
        setView('edit');
        focusName();
      }
    });

    window.addEventListener('storage', onStorageEvent);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    });
  }

  LuxCV.Builder = {
    init: init,
    resolveTemplateId: resolveTemplateId,
    getResume: function () { return state.resume; },
    getTemplateId: function () { return state.templateId; }
  };
})();
