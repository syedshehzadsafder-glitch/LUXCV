/* ==========================================================================
   LUXCV - auth-client.js
   Browser side of authentication. The session itself is an httpOnly cookie
   that JavaScript cannot read; this file only talks to /api/auth/*, keeps the
   "where was the visitor going" intent, and validates ?next= targets.
   Loaded on the public pages that start the flow (home, gallery), on
   auth.html, and on the signed-in pages.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var INTENT_KEY = 'luxcv:intended-template';

  /* ----- API ----- */

  /* Resolves { ok, status, data } and never rejects for HTTP errors.
     A network failure resolves { ok: false, status: 0, network: true }. */
  function api(method, url, body, options) {
    var init = {
      method: method,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'luxcv', 'Accept': 'application/json' }
    };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (options && options.keepalive) {
      init.keepalive = true;
    }
    return fetch(url, init).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      });
    }, function () {
      return { ok: false, status: 0, data: {}, network: true };
    });
  }

  function me() {
    return api('GET', '/api/auth/me');
  }

  /* ----- ?next= handling ----- */

  /* Accepts only same-origin paths. Anything else (other sites, //host,
     javascript:, backslash tricks) is dropped, so the login page can never be
     used as an open redirect. */
  function safeNext(raw) {
    if (typeof raw !== 'string' || !raw || raw.length > 500) {
      return '';
    }
    if (raw.charAt(0) !== '/' || raw.charAt(1) === '/' || raw.indexOf('\\') !== -1 || /[\u0000-\u001f]/.test(raw)) {
      return '';
    }
    try {
      var url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) {
        return '';
      }
      if (/^\/auth\.html/i.test(url.pathname)) {
        return '';
      }
      return url.pathname + url.search + url.hash;
    } catch (error) {
      return '';
    }
  }

  function builderUrl(templateId) {
    return '/builder.html' + (templateId ? '?template=' + encodeURIComponent(templateId) : '');
  }

  function rememberIntent(templateId) {
    try {
      if (templateId) {
        window.sessionStorage.setItem(INTENT_KEY, templateId);
      } else {
        window.sessionStorage.removeItem(INTENT_KEY);
      }
    } catch (error) { /* sessionStorage can be blocked; ?next= still carries it */ }
  }

  function recallIntent() {
    try {
      return window.sessionStorage.getItem(INTENT_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function forgetIntent() {
    rememberIntent('');
  }

  function templateFromUrl(url) {
    try {
      return new URL(url, window.location.origin).searchParams.get('template') || '';
    } catch (error) {
      return '';
    }
  }

  function authUrl(next) {
    var safe = safeNext(next);
    return '/auth.html' + (safe ? '?next=' + encodeURIComponent(safe) : '');
  }

  /* Sends the visitor to the login page, remembering where they were going. */
  function goToAuth(next) {
    window.location.replace(authUrl(next));
  }

  /* ----- local cache hygiene ----- */

  /* After logout, remove this person's cached draft from the browser, unless
     it holds edits that never reached the server. */
  function clearLocalCache(userId) {
    if (!userId) {
      return;
    }
    try {
      var prefix = 'luxcv:u:' + userId + ':';
      var meta = JSON.parse(window.localStorage.getItem(prefix + 'cloud') || 'null');
      if (meta && meta.dirty) {
        return;
      }
      window.localStorage.removeItem(prefix + 'resume');
      window.localStorage.removeItem(prefix + 'cloud');
    } catch (error) { /* nothing to clean if storage is blocked */ }
  }

  /* The "dirty" marker can be stale: a save sent while the page was closing
     reaches the server but the page is gone before it can clear the marker.
     So before trusting it, compare the cached draft with the server's copy.
     Resolves true when nothing is pending. Any doubt resolves false. */
  function reconcileCache(userId) {
    try {
      var prefix = 'luxcv:u:' + userId + ':';
      var meta = JSON.parse(window.localStorage.getItem(prefix + 'cloud') || 'null');
      if (!meta || !meta.dirty) {
        return Promise.resolve(true);
      }
      var cached = JSON.parse(window.localStorage.getItem(prefix + 'resume') || 'null');
      if (!cached || !cached.resume) {
        return Promise.resolve(true);
      }
      if (!meta.id) {
        return Promise.resolve(false); /* never delivered at all */
      }
      return api('GET', '/api/resumes/' + encodeURIComponent(meta.id)).then(function (result) {
        if (result.ok && result.data.resume &&
            JSON.stringify(result.data.resume.data) === JSON.stringify(cached.resume)) {
          meta.dirty = false;
          window.localStorage.setItem(prefix + 'cloud', JSON.stringify(meta));
          return true;
        }
        return false;
      });
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function logout(userId) {
    /* Reconcile first: once the cookie is cleared the server can't be asked. */
    return reconcileCache(userId).then(function () {
      return api('POST', '/api/auth/logout');
    }).then(function (result) {
      clearLocalCache(userId);
      forgetIntent();
      return result;
    });
  }

  LuxCV.Auth = {
    api: api,
    me: me,
    login: function (body) { return api('POST', '/api/auth/login', body); },
    register: function (body) { return api('POST', '/api/auth/register', body); },
    logout: logout,
    safeNext: safeNext,
    builderUrl: builderUrl,
    authUrl: authUrl,
    goToAuth: goToAuth,
    rememberIntent: rememberIntent,
    recallIntent: recallIntent,
    forgetIntent: forgetIntent,
    templateFromUrl: templateFromUrl,
    clearLocalCache: clearLocalCache
  };
})();
