/* ==========================================================================
   LUXCV — nav-profile.js
   Public navbar: while the visitor is logged in, a profile icon appears to the
   right of the "Create Resume" button and opens the user's dashboard.
   Logged out (or anything fails) -> nothing is added at all.
   The session is checked with the server (/api/auth/me); no flag in
   localStorage is trusted.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function icon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var head = document.createElementNS(SVG_NS, 'circle');
    head.setAttribute('cx', '12'); head.setAttribute('cy', '8'); head.setAttribute('r', '3.6');
    var body = document.createElementNS(SVG_NS, 'path');
    body.setAttribute('d', 'M4.5 20c.6-3.7 3.7-6 7.5-6s6.9 2.3 7.5 6');
    svg.appendChild(head); svg.appendChild(body);
    return svg;
  }

  function existing() {
    return document.querySelector('[data-nav-profile]');
  }

  function add(user) {
    var cta = document.querySelector('.nav__cta');
    if (!cta || existing()) {
      return;
    }
    var link = document.createElement('a');
    link.className = 'nav__profile';
    link.href = 'dashboard.html';
    link.setAttribute('data-nav-profile', '');
    link.setAttribute('aria-label', 'My dashboard (' + user.name + ')');
    link.title = 'My dashboard';
    link.appendChild(icon());
    var label = document.createElement('span');
    label.className = 'nav__profile-label';
    label.textContent = 'My Dashboard';
    link.appendChild(label);
    cta.insertAdjacentElement('afterend', link); /* directly to the right of Create Resume */
  }

  function remove() {
    var node = existing();
    if (node) {
      node.remove();
    }
  }

  function refresh() {
    if (!LuxCV.Auth) {
      return;
    }
    LuxCV.Auth.me().then(function (result) {
      if (result.ok && result.data.user) {
        add(result.data.user);
      } else {
        remove();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
  /* Back/forward cache: re-check so a logged-out page never keeps the icon. */
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      refresh();
    }
  });
})();
