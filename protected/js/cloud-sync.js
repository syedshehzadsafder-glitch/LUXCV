/* ==========================================================================
   LUXCV - cloud-sync.js
   Connects the builder to the user's account. This file is served only to
   logged-in users (see server/middleware/pageGate.js).

   The builder keeps working exactly as before against its local draft; this
   module (1) confirms the session and loads the account's resume into that
   local copy before the builder starts, and (2) mirrors every later save to
   the server (POST /api/resumes, PUT /api/resumes/:id).

   The server is the source of truth. The local copy is a per-account cache
   under luxcv:u:<userId>:resume, plus a small marker (luxcv:u:<userId>:cloud =
   { id, dirty }) that records edits not yet delivered, so a closed tab or a
   dropped connection never loses work: the next visit pushes them first.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var SYNC_DELAY_MS = 1200;
  var KEEPALIVE_LIMIT = 60000; /* browsers refuse keepalive bodies over 64 KB */

  var user = null;
  var metaKey = '';
  var state = { resumeId: '', timer: 0, inflight: null, again: false, version: 0, epoch: 0, failed: false };

  function Auth() { return LuxCV.Auth; }
  function Storage() { return LuxCV.Storage; }
  function Data() { return LuxCV.Data; }

  /* ---------- marker ---------- */

  function readMeta() {
    var meta = Storage().read(metaKey, null);
    return meta && typeof meta === 'object' ? meta : {};
  }

  function writeMeta(meta) {
    Storage().write(metaKey, meta);
  }

  function setMeta(patch) {
    var meta = readMeta();
    Object.keys(patch).forEach(function (key) { meta[key] = patch[key]; });
    writeMeta(meta);
  }

  /* ---------- save-status text ---------- */

  function showStatus(suffix) {
    var node = document.querySelector('[data-save-status]');
    if (!node) {
      return;
    }
    var base = node.textContent.replace(/ · (saved to your account|not synced.*)$/, '');
    node.textContent = base + suffix;
  }

  function redirectToLogin() {
    Auth().goToAuth(window.location.pathname + window.location.search);
  }

  /* ---------- local cache ---------- */

  function cacheResume(resume) {
    var data = resume.data || {};
    data.templateId = resume.templateId;
    Storage().saveDraftResult(data, { force: true, silent: true });
  }

  function localPayload() {
    var draft = Storage().loadDraft();
    if (!draft) {
      return null;
    }
    var D = Data();
    var templateId = D.resolveTemplateId(draft.resume.templateId) || D.DEFAULT_TEMPLATE_ID;
    return { templateId: templateId, data: draft.resume };
  }

  /* ---------- talking to the server ---------- */

  /* Sends the current local draft. Resolves when the queue is empty. */
  function sync(options) {
    if (state.inflight) {
      state.again = true;
      return state.inflight;
    }
    var body = localPayload();
    if (!body) {
      return Promise.resolve();
    }

    state.failed = false;
    var version = state.version;
    var epoch = state.epoch;
    var updating = !!state.resumeId;
    var keepalive = !!(options && options.keepalive) && JSON.stringify(body).length < KEEPALIVE_LIMIT;
    var request = updating
      ? Auth().api('PUT', '/api/resumes/' + encodeURIComponent(state.resumeId), body, { keepalive: keepalive })
      : Auth().api('POST', '/api/resumes', body, { keepalive: keepalive });

    state.inflight = request.then(function (result) {
      state.inflight = null;

      if (result.ok && result.data.resume) {
        var id = result.data.resume.id;
        if (epoch !== state.epoch) {
          /* The person cleared the resume while this save was in flight. */
          Auth().api('DELETE', '/api/resumes/' + encodeURIComponent(id));
        } else {
          state.resumeId = id;
          setMeta({ id: id, dirty: version !== state.version });
          state.failed = false;
          showStatus(' · saved to your account');
        }
      } else if (result.status === 401) {
        redirectToLogin();
        return;
      } else if (result.status === 404 && updating) {
        state.resumeId = ''; /* deleted elsewhere: save it again as a new one */
        state.again = true;
      } else {
        state.failed = true;
        showStatus(' · not synced yet - will retry');
      }

      if (state.again && !state.failed) {
        state.again = false;
        return sync(options);
      }
      state.again = false;
      return undefined;
    });
    return state.inflight;
  }

  function scheduleSync(delay) {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(function () { sync(); }, typeof delay === 'number' ? delay : SYNC_DELAY_MS);
  }

  function onDraftSaved() {
    state.version += 1;
    setMeta({ id: state.resumeId, dirty: true });
    scheduleSync();
  }

  function onDraftCleared() {
    window.clearTimeout(state.timer);
    state.epoch += 1;
    state.version += 1;
    var id = state.resumeId;
    state.resumeId = '';
    writeMeta({ id: '', dirty: false });
    if (!id) {
      return;
    }
    Auth().api('DELETE', '/api/resumes/' + encodeURIComponent(id)).then(function (result) {
      if (result.status === 401) {
        redirectToLogin();
      }
    });
  }

  /* ---------- boot ---------- */

  function fetchWanted() {
    var wanted = '';
    try {
      wanted = new URLSearchParams(window.location.search).get('resume') || '';
    } catch (error) { wanted = ''; }

    function latest() {
      return Auth().api('GET', '/api/resumes/latest').then(function (result) {
        return result.ok ? { ok: true, resume: result.data.resume } : result;
      });
    }
    if (!wanted) {
      return latest();
    }
    return Auth().api('GET', '/api/resumes/' + encodeURIComponent(wanted)).then(function (result) {
      return result.ok ? { ok: true, resume: result.data.resume } : latest();
    });
  }

  /* Edits that never reached the server for a different resume than the one
     being opened are delivered first, so opening another resume loses nothing. */
  function pushOtherDirty(meta, openingId) {
    var local = Storage().loadDraft();
    if (!meta.dirty || !meta.id || meta.id === openingId || !local) {
      return Promise.resolve();
    }
    var D = Data();
    var body = { templateId: D.resolveTemplateId(local.resume.templateId) || D.DEFAULT_TEMPLATE_ID, data: local.resume };
    return Auth().api('PUT', '/api/resumes/' + encodeURIComponent(meta.id), body).then(function () { return undefined; });
  }

  function adoptServerState(found) {
    var meta = readMeta();
    var local = Storage().inspectDraft();
    var resume = found.resume;

    if (resume) {
      return pushOtherDirty(meta, resume.id).then(function () {
        state.resumeId = resume.id;
        /* A stale marker (the save landed but the page closed first) is not
           unsynced work: when the cached draft equals the server copy, the
           server copy wins and the marker is cleared. */
        var identical = local.status === 'ok' && JSON.stringify(local.draft.resume) === JSON.stringify(resume.data);
        var keepLocal = meta.dirty && meta.id === resume.id && local.status === 'ok' && !identical;
        if (keepLocal) {
          scheduleSync(0); /* deliver edits the last visit could not */
        } else {
          cacheResume(resume);
          writeMeta({ id: resume.id, dirty: false });
        }
      });
    }

    /* Nothing on the server. */
    state.resumeId = '';
    if (local.status === 'ok' && (meta.dirty || !meta.id)) {
      if (meta.dirty) {
        setMeta({ id: '', dirty: true });
        scheduleSync(0);
      }
      return Promise.resolve();
    }
    if (local.status === 'ok' && meta.id) {
      Storage().clearDraft(); /* it was deleted from the account elsewhere */
      return Promise.resolve();
    }

    /* A draft saved by the pre-account version of LUXCV in this browser. */
    var legacy = Storage().read(Storage().LEGACY_RESUME_KEY, null);
    if (legacy && legacy.resume && typeof legacy.resume === 'object') {
      Storage().saveDraftResult(legacy.resume, { force: true, silent: true });
      Storage().remove(Storage().LEGACY_RESUME_KEY);
      writeMeta({ id: '', dirty: true });
      scheduleSync(0);
    }
    return Promise.resolve();
  }

  function showFatal() {
    var box = document.getElementById('notice');
    if (!box) {
      return;
    }
    box.className = 'alert alert--error';
    box.textContent = 'We couldn’t reach the LUXCV server, so your account can’t be checked. ';
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn--secondary btn--sm';
    retry.textContent = 'Try again';
    retry.addEventListener('click', function () { window.location.reload(); });
    box.appendChild(retry);
    box.hidden = false;
  }

  /* Resolves true when the builder may start. */
  function boot() {
    return Auth().me().then(function (result) {
      if (result.status === 401) {
        redirectToLogin();
        return false;
      }
      if (!result.ok) {
        showFatal();
        return false;
      }
      user = result.data.user;
      metaKey = 'luxcv:u:' + user.id + ':cloud';
      Storage().setScope(user.id);

      return fetchWanted().then(function (found) {
        if (found.status === 401) {
          redirectToLogin();
          return false;
        }
        if (found.network || !found.ok) {
          /* Offline: carry on with the local cache; edits sync when we're back. */
          showStatus(' · offline');
          return true;
        }
        return adoptServerState(found).then(function () { return true; });
      });
    });
  }

  /* Called after the builder has started, so its own save-on-hide runs first. */
  function attach() {
    Storage().hooks.onDraftSaved = onDraftSaved;
    Storage().hooks.onDraftCleared = onDraftCleared;

    function flush() {
      if (readMeta().dirty) {
        window.clearTimeout(state.timer);
        sync({ keepalive: true });
      }
    }
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flush(); }
    });
    window.addEventListener('online', function () {
      if (readMeta().dirty) { scheduleSync(0); }
    });
  }

  /* Re-checks the session with the server. Used before printing and PDF export. */
  function guard() {
    return Auth().me().then(function (result) {
      if (result.ok) {
        return { ok: true };
      }
      if (result.status === 401) {
        redirectToLogin();
        return { ok: false, reason: 'auth' };
      }
      return { ok: false, reason: 'network' };
    });
  }

  LuxCV.Cloud = { boot: boot, attach: attach, guard: guard, syncNow: function () { return sync(); } };
})();
