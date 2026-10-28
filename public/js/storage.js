/* ==========================================================================
   LUXCV - storage.js
   Failure-safe wrapper around localStorage. Every call is wrapped in
   try/catch because storage can be blocked (private mode, strict settings),
   full, or hold data that is not valid JSON.

   Draft format (key luxcv:resume):  { savedAt: ISO string, rev: string, resume }
   `rev` changes on every write. A tab remembers the rev it last loaded or
   saved; before writing it checks that the stored rev is still that one, so a
   newer copy saved in another tab is never overwritten silently.

   Only resume content, the template choice and appearance settings are stored.
   This file never handles passwords or tokens (the session is an httpOnly
   cookie). The resume is mirrored to the user's account by cloud-sync.js.

   Status words used in results:
     unavailable  storage is blocked or missing
     quota        the browser says storage is full
     corrupt      stored text is not valid JSON or not a resume
     conflict     the stored copy was changed by another tab/window
     error        any other failure
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var KEYS = {
    RESUME: 'luxcv:resume',
    PREFS: 'luxcv:prefs'
  };

  /* Per-account scoping (added with accounts): once the builder knows who is
     logged in, the cached draft lives under luxcv:u:<userId>:resume so two
     people sharing a browser never see each other's resume. The template
     preference stays global. onDraftSaved / onDraftCleared let cloud-sync.js
     mirror every change to the server. */
  var LEGACY_RESUME_KEY = 'luxcv:resume';
  var hooks = { onDraftSaved: null, onDraftCleared: null };

  function setScope(userId) {
    KEYS.RESUME = userId ? 'luxcv:u:' + userId + ':resume' : LEGACY_RESUME_KEY;
  }

  function fire(name, arg) {
    try {
      if (typeof hooks[name] === 'function') {
        hooks[name](arg);
      }
    } catch (error) { /* a sync problem must never break local saving */ }
  }

  function getStore() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null; /* Accessing localStorage itself can throw. */
    }
  }

  function isQuotaError(error) {
    if (!error) {
      return false;
    }
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 || error.code === 1014;
  }

  function isAvailable() {
    try {
      var store = getStore();
      if (!store) {
        return false;
      }
      var probe = '__luxcv_probe__';
      store.setItem(probe, '1');
      store.removeItem(probe);
      return true;
    } catch (error) {
      /* A full store still exists; the probe just could not be written. */
      return isQuotaError(error);
    }
  }

  function read(key, fallback) {
    try {
      var raw = getStore().getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  /* Returns { ok, status } for a write: status is '' on success. */
  function writeResult(key, value) {
    var store = getStore();
    if (!store) {
      return { ok: false, status: 'unavailable' };
    }
    try {
      store.setItem(key, JSON.stringify(value));
      return { ok: true, status: '' };
    } catch (error) {
      return { ok: false, status: isQuotaError(error) ? 'quota' : 'unavailable' };
    }
  }

  function write(key, value) {
    return writeResult(key, value).ok;
  }

  function remove(key) {
    try {
      getStore().removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ----- Preferences (currently just the chosen template) ----- */
  function getPreferences() {
    var prefs = read(KEYS.PREFS, {});
    return prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? prefs : {};
  }

  /* Stores the canonical id, so an old alias never lingers in storage. */
  function setPreferredTemplate(templateId) {
    var Data = LuxCV.Data;
    var resolved = Data ? Data.resolveTemplateId(templateId) : templateId;
    if (!resolved) {
      return false;
    }
    var prefs = getPreferences();
    prefs.templateId = resolved;
    return write(KEYS.PREFS, prefs);
  }

  /* Returns the stored template id, or null when the user has not chosen one. */
  function getStoredTemplate() {
    var Data = LuxCV.Data;
    return Data ? Data.resolveTemplateId(getPreferences().templateId) : null;
  }

  /* ----- Resume draft ----- */

  function newRevision() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* Reads the stored draft without throwing. Returns
       { status: 'none' | 'ok' | 'corrupt' | 'unavailable',
         draft: { resume, savedAt, rev } | null }
     The caller must pass draft.resume through Data.migrateResume() before
     trusting it. */
  function inspectDraft() {
    var store = getStore();
    if (!store) {
      return { status: 'unavailable', draft: null };
    }
    var raw;
    try {
      raw = store.getItem(KEYS.RESUME);
    } catch (error) {
      return { status: 'unavailable', draft: null };
    }
    if (raw === null) {
      return { status: 'none', draft: null };
    }
    var stored;
    try {
      stored = JSON.parse(raw);
    } catch (error) {
      return { status: 'corrupt', draft: null };
    }
    var resume = stored && typeof stored === 'object' && stored.resume && typeof stored.resume === 'object' &&
      !Array.isArray(stored.resume) ? stored.resume : null;
    if (!resume) {
      return { status: 'corrupt', draft: null };
    }
    return {
      status: 'ok',
      draft: {
        resume: resume,
        savedAt: typeof stored.savedAt === 'string' ? stored.savedAt : '',
        rev: typeof stored.rev === 'string' ? stored.rev : ''
      }
    };
  }

  /* Returns { resume, savedAt } for the saved draft, or null. */
  function loadDraft() {
    var info = inspectDraft();
    return info.draft ? { resume: info.draft.resume, savedAt: info.draft.savedAt } : null;
  }

  /* The revision currently stored: '' when there is a draft without a rev
     (older versions) and null when there is no readable draft at all. */
  function storedRevision() {
    var info = inspectDraft();
    if (info.status === 'none') {
      return null;
    }
    /* Unreadable data counts as nothing saved: it cannot be recovered anyway. */
    return info.draft ? info.draft.rev : null;
  }

  /* Saves the draft.
       options.baseRev - the revision this tab last loaded or saved ('' when it
                         started with nothing saved). When the stored revision
                         differs, nothing is written and status is 'conflict'.
       options.force   - skip that check (the user chose to overwrite).
     Returns { ok, status, savedAt, rev }. */
  function saveDraftResult(resume, options) {
    var opts = options || {};
    if (!getStore()) {
      return { ok: false, status: 'unavailable', savedAt: '', rev: '' };
    }
    if (!opts.force && typeof opts.baseRev === 'string') {
      var current = storedRevision();
      var expected = opts.baseRev;
      var same = (current === null && expected === '') || current === expected;
      if (!same) {
        return { ok: false, status: 'conflict', savedAt: '', rev: '' };
      }
    }
    var savedAt = new Date().toISOString();
    var rev = newRevision();
    var result = writeResult(KEYS.RESUME, { savedAt: savedAt, rev: rev, resume: resume });
    if (result.ok && !opts.silent) {
      fire('onDraftSaved', resume);
    }
    return { ok: result.ok, status: result.status, savedAt: result.ok ? savedAt : '', rev: result.ok ? rev : '' };
  }

  /* Simple form kept for older callers: ISO save time, or '' on failure. */
  function saveDraft(resume) {
    return saveDraftResult(resume, { force: true }).savedAt;
  }

  function clearDraft() {
    var removed = remove(KEYS.RESUME);
    fire('onDraftCleared');
    return removed;
  }

  /* Removes everything LUXCV keeps in this browser (draft and preferences).
     Returns true only when both removals worked. */
  function deleteAll() {
    var draft = remove(KEYS.RESUME);
    var prefs = remove(KEYS.PREFS);
    fire('onDraftCleared');
    return draft && prefs;
  }

  function hasAnyData() {
    var store = getStore();
    if (!store) {
      return false;
    }
    try {
      return store.getItem(KEYS.RESUME) !== null || store.getItem(KEYS.PREFS) !== null;
    } catch (error) {
      return false;
    }
  }

  LuxCV.Storage = {
    KEYS: KEYS,
    hooks: hooks,
    setScope: setScope,
    LEGACY_RESUME_KEY: LEGACY_RESUME_KEY,
    inspectDraft: inspectDraft,
    loadDraft: loadDraft,
    saveDraft: saveDraft,
    saveDraftResult: saveDraftResult,
    storedRevision: storedRevision,
    clearDraft: clearDraft,
    deleteAll: deleteAll,
    hasAnyData: hasAnyData,
    isAvailable: isAvailable,
    read: read,
    write: write,
    remove: remove,
    getPreferences: getPreferences,
    setPreferredTemplate: setPreferredTemplate,
    getStoredTemplate: getStoredTemplate
  };
})();
