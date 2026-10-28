/* ==========================================================================
   LUXCV - auth-gate.js
   Loaded on the public pages (home, gallery). Every link into the builder -
   "Use Template", "Build My Resume", "Create Resume" - passes through here:

     logged in   -> straight to the builder with that template
     logged out  -> /auth.html?next=<builder url>, intent kept in sessionStorage

   This is a convenience for a smooth flow. The real protection is on the
   server: builder.html is not served without a valid session, so a link that
   skips this script is redirected to /auth.html anyway.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var busy = false;

  function builderLink(event) {
    var link = event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) {
      return null;
    }
    try {
      var url = new URL(link.getAttribute('href'), window.location.href);
      if (url.origin === window.location.origin && /\/builder\.html$/i.test(url.pathname)) {
        return url;
      }
    } catch (error) { /* ignore malformed links */ }
    return null;
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return; /* new-tab clicks fall through to the server-side gate */
    }
    var url = builderLink(event);
    if (!url || !LuxCV.Auth) {
      return;
    }

    event.preventDefault();
    if (busy) {
      return;
    }
    busy = true;

    var templateId = url.searchParams.get('template') || '';
    var target = '/builder.html' + url.search;

    LuxCV.Auth.me().then(function (result) {
      if (result.ok) {
        window.location.assign(target);
      } else if (result.status === 401) {
        LuxCV.Auth.rememberIntent(templateId);
        LuxCV.Auth.goToAuth(target);
      } else {
        window.location.assign(target); /* server could not be asked: let its gate decide */
      }
    }).then(function () {
      busy = false;
    });
  });

  /* Coming back with the browser's back button must not leave a stuck state. */
  window.addEventListener('pageshow', function () {
    busy = false;
  });
})();
