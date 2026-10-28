/* ==========================================================================
   LUXCV - admin.js
   Admin dashboard: list users, activate / deactivate, delete (with all their
   resumes). Served only to administrators; every action is enforced again by
   the server (protect + isAdmin) on /api/admin/*.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var doc = document;
  var el;
  var Auth;
  var me = null;

  var state = { page: 1, pages: 1, q: '', status: '' };

  function $(selector) { return doc.querySelector(selector); }

  function notice(kind, text) {
    var box = $('#admin-notice');
    box.className = 'alert alert--' + (kind === 'error' ? 'error' : 'success');
    box.textContent = text;
    box.hidden = false;
    box.focus();
  }

  function hideNotice() { $('#admin-notice').hidden = true; }

  function formatDate(iso) {
    var date = new Date(iso);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString([], { dateStyle: 'medium' });
  }

  /* Any 401/403 from the API means the session or role is gone. */
  function handleAuthFailure(result) {
    if (result.status === 401) { Auth.goToAuth('/admin.html'); return true; }
    if (result.status === 403 && result.data && result.data.code === 'FORBIDDEN') {
      window.location.replace('/dashboard.html');
      return true;
    }
    return false;
  }

  function message(result, fallback) {
    return result.network ? 'We couldn’t reach the server.' : (result.data && result.data.message) || fallback;
  }

  /* ---------- table ---------- */

  function badge(text, kind) { return el('span', { class: 'badge badge--' + kind, text: text }); }

  function row(user) {
    var self = me && user.id === me.id;
    var actions = el('td', { class: 'cell-actions' });

    if (self) {
      actions.appendChild(el('span', { class: 'badge', text: 'You' }));
    } else {
      var toggle = el('button', {
        type: 'button',
        class: 'btn btn--secondary btn--sm',
        text: user.isActive ? 'Deactivate' : 'Activate'
      }, [el('span', { class: 'visually-hidden', text: ' ' + user.username })]);
      toggle.addEventListener('click', function () { setStatus(user, toggle); });

      var remove = el('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete' }, [
        el('span', { class: 'visually-hidden', text: ' ' + user.username })
      ]);
      remove.addEventListener('click', function () { removeUser(user, remove); });
      actions.appendChild(toggle);
      actions.appendChild(remove);
    }

    return el('tr', {}, [
      el('td', { class: 'cell-name', text: user.username }),
      el('td', { class: 'cell-email', text: user.email }),
      el('td', {}, [badge(user.role === 'admin' ? 'Admin' : 'User', user.role === 'admin' ? 'admin' : 'user')]),
      el('td', {}, [badge(user.isActive ? 'Active' : 'Inactive', user.isActive ? 'active' : 'inactive')]),
      el('td', { text: formatDate(user.createdAt) }),
      el('td', { text: String(user.resumeCount || 0) }),
      actions
    ]);
  }

  function render(data) {
    var body = $('#users-body');
    LuxCV.Dom.clear(body);
    if (!data.users.length) {
      body.appendChild(el('tr', {}, [el('td', { class: 'table-empty', colspan: '7', text: 'No users match your search.' })]));
    } else {
      data.users.forEach(function (user) { body.appendChild(row(user)); });
    }

    state.page = data.page;
    state.pages = data.pages;
    $('#pager-info').textContent = data.total + (data.total === 1 ? ' user' : ' users') + ' · page ' + data.page + ' of ' + data.pages;
    $('[data-page-step="-1"]').disabled = data.page <= 1;
    $('[data-page-step="1"]').disabled = data.page >= data.pages;

    ['total', 'active', 'inactive', 'admins'].forEach(function (key) {
      $('[data-stat="' + key + '"]').textContent = String(data.stats[key]);
    });
  }

  function load() {
    var query = '?page=' + state.page + '&limit=20' +
      (state.q ? '&q=' + encodeURIComponent(state.q) : '') +
      (state.status ? '&status=' + encodeURIComponent(state.status) : '');
    return Auth.api('GET', '/api/admin/users' + query).then(function (result) {
      if (handleAuthFailure(result)) { return; }
      if (!result.ok) { notice('error', message(result, 'Users could not be loaded.')); return; }
      render(result.data);
    });
  }

  /* ---------- actions ---------- */

  function setStatus(user, button) {
    var next = !user.isActive;
    button.disabled = true;
    hideNotice();
    Auth.api('PUT', '/api/admin/users/' + encodeURIComponent(user.id) + '/status', { isActive: next }).then(function (result) {
      if (handleAuthFailure(result)) { return; }
      if (result.ok) {
        notice('success', user.username + ' was ' + (next ? 'activated.' : 'deactivated. They are signed out on their next request.'));
      } else {
        notice('error', message(result, 'The status could not be changed.'));
      }
      load();
    });
  }

  function removeUser(user, opener) {
    var dialog = $('#admin-confirm');
    $('#admin-confirm-title').textContent = 'Delete ' + user.username + '?';
    $('#admin-confirm-text').textContent = 'This permanently deletes the account for ' + user.email +
      ' and all of their saved resumes (' + (user.resumeCount || 0) + '). This can’t be undone.';
    $('#admin-confirm-ok').textContent = 'Delete user';

    LuxCV.Dialog.confirm(dialog, opener).then(function (confirmed) {
      if (!confirmed) { return; }
      hideNotice();
      Auth.api('DELETE', '/api/admin/users/' + encodeURIComponent(user.id)).then(function (result) {
        if (handleAuthFailure(result)) { return; }
        if (result.ok) {
          notice('success', user.username + ' and ' + (result.data.deletedResumes || 0) + ' saved resume(s) were deleted.');
          if (state.page > 1 && $('#users-body').children.length === 1) { state.page -= 1; }
        } else {
          notice('error', message(result, 'The user could not be deleted.'));
        }
        load();
      });
    });
  }

  /* ---------- init ---------- */

  function init() {
    Auth = LuxCV.Auth;
    el = LuxCV.Dom.el;
    LuxCV.Dialog.setup($('#admin-confirm'));

    Auth.me().then(function (result) {
      if (handleAuthFailure(result)) { return; }
      if (!result.ok) { notice('error', message(result, 'Could not verify your session.')); return; }
      if (result.data.user.role !== 'admin') { window.location.replace('/dashboard.html'); return; }
      me = result.data.user;
      $('#admin-who').textContent = 'Signed in as ' + me.name;
      load();
    });

    $('#filter-form').addEventListener('submit', function (event) {
      event.preventDefault();
      state.q = $('#filter-q').value.trim();
      state.status = $('#filter-status').value;
      state.page = 1;
      load();
    });

    Array.prototype.forEach.call(doc.querySelectorAll('[data-page-step]'), function (button) {
      button.addEventListener('click', function () {
        var target = state.page + parseInt(button.getAttribute('data-page-step'), 10);
        if (target >= 1 && target <= state.pages) { state.page = target; load(); }
      });
    });

    Array.prototype.forEach.call(doc.querySelectorAll('[data-action="logout"]'), function (button) {
      button.addEventListener('click', function () {
        button.disabled = true;
        Auth.logout(me && me.id).then(function () { window.location.replace('index.html'); });
      });
    });

    window.addEventListener('pageshow', function (event) {
      if (event.persisted) {
        Auth.me().then(function (result) { if (!result.ok) { Auth.goToAuth('/admin.html'); } });
      }
    });
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
