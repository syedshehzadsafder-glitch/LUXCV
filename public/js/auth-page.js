/* ==========================================================================
   LUXCV - auth-page.js
   Controller for auth.html: Login / Create Account tabs, validation, and the
   return trip to the template the visitor originally chose.

   Where to go after success, in order:
     1. ?next=…            (validated: same-origin paths only)
     2. the template id kept in sessionStorage -> /builder.html?template=…
     3. admins -> /admin.html, everyone else -> /dashboard.html
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var doc = document;
  var Auth;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function $(id) { return doc.getElementById(id); }

  /* ---------- destination ---------- */

  function params() {
    try { return new URLSearchParams(window.location.search); } catch (error) { return new URLSearchParams(''); }
  }

  function intendedTemplate() {
    var Data = LuxCV.Data;
    var next = Auth.safeNext(params().get('next') || '');
    var raw = (next && Auth.templateFromUrl(next)) || Auth.recallIntent();
    return Data && raw ? Data.resolveTemplateId(raw) || '' : '';
  }

  function destination(user) {
    var next = Auth.safeNext(params().get('next') || '');
    if (next) {
      return next;
    }
    var template = intendedTemplate();
    if (template) {
      return Auth.builderUrl(template);
    }
    return user && user.role === 'admin' ? '/admin.html' : '/dashboard.html';
  }

  function finish(user) {
    var target = destination(user);
    Auth.forgetIntent();
    window.location.replace(target);
  }

  /* ---------- tabs ---------- */

  var tabs = {};
  var panels = {};

  function showTab(name, focusFirst) {
    ['login', 'register'].forEach(function (key) {
      var active = key === name;
      tabs[key].setAttribute('aria-selected', String(active));
      tabs[key].tabIndex = active ? 0 : -1;
      panels[key].hidden = !active;
    });
    if (focusFirst) {
      var first = panels[name].querySelector('input');
      if (first) { first.focus(); }
    }
    try {
      var url = new URL(window.location.href);
      if (name === 'register') { url.searchParams.set('mode', 'register'); } else { url.searchParams.delete('mode'); }
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) { /* cosmetic only */ }
  }

  function bindTabs() {
    ['login', 'register'].forEach(function (key) {
      tabs[key] = $('tab-' + key);
      panels[key] = $('panel-' + key);
      tabs[key].addEventListener('click', function () { showTab(key, false); });
      tabs[key].addEventListener('keydown', function (event) {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          var other = key === 'login' ? 'register' : 'login';
          showTab(other, false);
          tabs[other].focus();
        }
      });
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-switch]'), function (button) {
      button.addEventListener('click', function () { showTab(button.getAttribute('data-switch'), true); });
    });
  }

  /* ---------- field helpers ---------- */

  function setError(form, field, message) {
    var input = form.elements[field];
    var error = $(form.id.replace('-form', '') + '-' + errorSuffix(field) + '-error');
    if (!input || !error) { return; }
    if (message) {
      error.textContent = message;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    } else {
      error.textContent = '';
      error.hidden = true;
      input.removeAttribute('aria-invalid');
    }
  }

  function errorSuffix(field) {
    return field === 'confirmPassword' ? 'confirm' : field;
  }

  function clearErrors(form) {
    ['name', 'email', 'password', 'confirmPassword'].forEach(function (field) {
      if (form.elements[field]) { setError(form, field, ''); }
    });
  }

  function showAlert(id, message) {
    var box = $(id);
    box.textContent = message;
    box.hidden = false;
    box.focus();
  }

  function hideAlert(id) {
    var box = $(id);
    box.hidden = true;
    box.textContent = '';
  }

  function applyServerErrors(form, errors) {
    var first = null;
    Object.keys(errors || {}).forEach(function (field) {
      if (form.elements[field]) {
        setError(form, field, errors[field]);
        first = first || form.elements[field];
      }
    });
    if (first) { first.focus(); }
    return !!first;
  }

  function setBusy(form, busy, idleLabel, busyLabel) {
    var button = form.querySelector('button[type="submit"]');
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    button.textContent = busy ? busyLabel : idleLabel;
  }

  /* ---------- validation (mirrors the server; the server is the authority) ---------- */

  function checkPassword(value) {
    if (value.length < 8) { return 'Password must be at least 8 characters.'; }
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) { return 'Password must contain at least one letter and one number.'; }
    return '';
  }

  var rules = {
    name: function (form) {
      var v = form.elements.name.value.trim();
      return v.length < 2 ? 'Please enter your full name (at least 2 characters).' : '';
    },
    email: function (form) {
      var v = form.elements.email.value.trim();
      if (!v) { return 'Please enter your email address.'; }
      return EMAIL_RE.test(v) ? '' : 'Please enter a valid email address.';
    },
    password: function (form) {
      var v = form.elements.password.value;
      if (form.id === 'login-form') { return v ? '' : 'Please enter your password.'; }
      return checkPassword(v);
    },
    confirmPassword: function (form) {
      var v = form.elements.confirmPassword.value;
      if (!v) { return 'Please confirm your password.'; }
      return v === form.elements.password.value ? '' : 'Passwords do not match.';
    }
  };

  function validate(form, fields) {
    var first = null;
    fields.forEach(function (field) {
      var message = rules[field](form);
      setError(form, field, message);
      if (message && !first) { first = form.elements[field]; }
    });
    if (first) { first.focus(); }
    return !first;
  }

  function liveValidation(form, fields) {
    fields.forEach(function (field) {
      var input = form.elements[field];
      input.addEventListener('blur', function () {
        if (input.value || input.getAttribute('aria-invalid')) { setError(form, field, rules[field](form)); }
      });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid')) { setError(form, field, rules[field](form)); }
        if (field === 'password' && form.elements.confirmPassword && form.elements.confirmPassword.getAttribute('aria-invalid')) {
          setError(form, 'confirmPassword', rules.confirmPassword(form));
        }
      });
    });
  }

  /* ---------- submit ---------- */

  function failureMessage(result, fallback) {
    if (result.network) { return 'We couldn’t reach the server. Check your connection and try again.'; }
    if (result.status === 429) { return 'Too many attempts. Please wait a few minutes and try again.'; }
    return (result.data && result.data.message) || fallback;
  }

  function onLogin(event) {
    event.preventDefault();
    var form = event.currentTarget;
    hideAlert('login-alert');
    if (!validate(form, ['email', 'password'])) { return; }

    setBusy(form, true, 'Log in', 'Logging in…');
    Auth.login({ email: form.elements.email.value.trim(), password: form.elements.password.value })
      .then(function (result) {
        if (result.ok) {
          finish(result.data.user);
          return;
        }
        setBusy(form, false, 'Log in', 'Logging in…');
        if (!applyServerErrors(form, result.data.errors)) {
          showAlert('login-alert', failureMessage(result, 'We couldn’t log you in. Please try again.'));
        }
      });
  }

  function onRegister(event) {
    event.preventDefault();
    var form = event.currentTarget;
    hideAlert('register-alert');
    if (!validate(form, ['name', 'email', 'password', 'confirmPassword'])) { return; }

    setBusy(form, true, 'Create account', 'Creating account…');
    Auth.register({
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      password: form.elements.password.value,
      confirmPassword: form.elements.confirmPassword.value
    }).then(function (result) {
      if (result.ok) {
        finish(result.data.user);
        return;
      }
      setBusy(form, false, 'Create account', 'Creating account…');
      var handled = applyServerErrors(form, result.data.errors);
      if (result.status === 409) {
        showAlert('register-alert', 'An account with this email already exists. You can log in instead.');
      } else if (!handled) {
        showAlert('register-alert', failureMessage(result, 'We couldn’t create your account. Please try again.'));
      }
    });
  }

  function bindPasswordToggles() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-toggle-password]'), function (button) {
      button.addEventListener('click', function () {
        var input = $(button.getAttribute('data-toggle-password'));
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.textContent = show ? 'Hide' : 'Show';
        button.setAttribute('aria-pressed', String(show));
      });
    });
  }

  function showIntent() {
    var template = intendedTemplate();
    var Data = LuxCV.Data;
    var box = $('intent');
    var info = template && Data ? Data.getTemplate(template) : null;
    if (!info) { return; }
    box.textContent = '';
    box.appendChild(doc.createTextNode('Continue to the '));
    var strong = doc.createElement('strong');
    strong.textContent = info.name;
    box.appendChild(strong);
    box.appendChild(doc.createTextNode(' template after you sign in.'));
    box.hidden = false;
  }

  /* ---------- init ---------- */

  function init() {
    Auth = LuxCV.Auth;
    if (!Auth) { return; }

    var next = Auth.safeNext(params().get('next') || '');
    var fromNext = next && Auth.templateFromUrl(next);
    if (fromNext) { Auth.rememberIntent(fromNext); }

    /* Already signed in: skip the form. */
    Auth.me().then(function (result) {
      if (result.ok) { finish(result.data.user); }
    });

    bindTabs();
    bindPasswordToggles();
    showIntent();

    var loginForm = $('login-form');
    var registerForm = $('register-form');
    loginForm.addEventListener('submit', onLogin);
    registerForm.addEventListener('submit', onRegister);
    liveValidation(loginForm, ['email']);
    liveValidation(registerForm, ['name', 'email', 'password', 'confirmPassword']);
    clearErrors(loginForm);

    showTab(params().get('mode') === 'register' ? 'register' : 'login', false);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
