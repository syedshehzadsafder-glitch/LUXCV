/* ==========================================================================
   LUXCV - dashboard.js
   The signed-in account area: profile, saved resumes (open / delete) and the
   only Log out button on the user side. Served only to logged-in users.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var doc = document;
  var el;
  var Auth;
  var user = null;

  function $(selector) { return doc.querySelector(selector); }

  function showAlert(message) {
    var box = $('#dash-alert');
    box.textContent = message;
    box.hidden = false;
    box.focus();
  }

  function formatDate(iso, withTime) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) { return '-'; }
    return withTime
      ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : date.toLocaleDateString([], { dateStyle: 'long' });
  }

  function templateName(id) {
    var template = LuxCV.Data && LuxCV.Data.getTemplate(LuxCV.Data.resolveTemplateId(id));
    return template ? template.name : 'Unknown template';
  }

  /* ---------- resumes ---------- */

  function openUrl(resume) {
    return '/builder.html?template=' + encodeURIComponent(resume.templateId) + '&resume=' + encodeURIComponent(resume.id);
  }

  function renderResumes(resumes) {
    var host = $('#resume-host');
    LuxCV.Dom.clear(host);

    if (!resumes.length) {
      host.appendChild(el('div', { class: 'empty-card' }, [
        el('p', { text: 'You haven’t saved a resume yet. Pick a template to get started.' }),
        el('a', { class: 'btn btn--primary', href: 'templates.html', text: 'Browse templates' })
      ]));
      return;
    }

    var list = el('ul', { class: 'resume-list', role: 'list' });
    resumes.forEach(function (resume) {
      var deleteButton = el('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete' }, [
        el('span', { class: 'visually-hidden', text: ' ' + resume.title })
      ]);
      deleteButton.addEventListener('click', function () { removeResume(resume, deleteButton); });

      list.appendChild(el('li', { class: 'resume-row' }, [
        el('div', {}, [
          el('p', { class: 'resume-row__title', text: resume.title }),
          el('p', { class: 'resume-row__meta', text: templateName(resume.templateId) + ' · edited ' + formatDate(resume.updatedAt, true) })
        ]),
        el('div', { class: 'resume-row__actions' }, [
          el('a', { class: 'btn btn--primary btn--sm', href: openUrl(resume), text: 'Open' }, [
            el('span', { class: 'visually-hidden', text: ' ' + resume.title })
          ]),
          deleteButton
        ])
      ]));
    });
    host.appendChild(list);
  }

  function loadResumes() {
    Auth.api('GET', '/api/resumes').then(function (result) {
      if (result.status === 401) { Auth.goToAuth('/dashboard.html'); return; }
      if (!result.ok) {
        LuxCV.Dom.clear($('#resume-host'));
        $('#resume-host').appendChild(el('p', { class: 'empty-card', text: 'Your resumes could not be loaded. Please refresh the page.' }));
        return;
      }
      renderResumes(result.data.resumes || []);
    });
  }

  function removeResume(resume, opener) {
    var dialog = $('#delete-resume-dialog');
    $('#delete-resume-text').textContent = '“' + resume.title + '” will be permanently deleted from your account. This can’t be undone.';
    LuxCV.Dialog.confirm(dialog, opener).then(function (confirmed) {
      if (!confirmed) { return; }
      Auth.api('DELETE', '/api/resumes/' + encodeURIComponent(resume.id)).then(function (result) {
        if (result.ok || result.status === 404) {
          /* the builder's cached copy must not resurrect it */
          try {
            var meta = JSON.parse(window.localStorage.getItem('luxcv:u:' + user.id + ':cloud') || 'null');
            if (meta && meta.id === resume.id) {
              window.localStorage.removeItem('luxcv:u:' + user.id + ':cloud');
              window.localStorage.removeItem('luxcv:u:' + user.id + ':resume');
            }
          } catch (error) { /* storage blocked: nothing cached */ }
          loadResumes();
        } else if (result.status === 401) {
          Auth.goToAuth('/dashboard.html');
        } else {
          showAlert((result.data && result.data.message) || 'The resume could not be deleted.');
        }
      });
    });
  }

  /* ---------- logout ---------- */

  function logout(button) {
    button.disabled = true;
    Auth.logout(user && user.id).then(function () {
      window.location.replace('index.html');
    });
  }

  /* ---------- init ---------- */

  function init() {
    Auth = LuxCV.Auth;
    el = LuxCV.Dom.el;
    LuxCV.Dialog.setup($('#delete-resume-dialog'));

    Auth.me().then(function (result) {
      if (!result.ok) {
        if (result.status === 401) { Auth.goToAuth('/dashboard.html'); return; }
        showAlert('We couldn’t reach the server. Please refresh the page.');
        return;
      }
      user = result.data.user;
      $('#welcome').textContent = 'Welcome back, ' + user.name.split(' ')[0];
      $('[data-fact="name"]').textContent = user.name;
      $('[data-fact="email"]').textContent = user.email;
      $('[data-fact="since"]').textContent = formatDate(user.createdAt, false);
      if (user.role === 'admin') { $('[data-admin-link]').hidden = false; }
      loadResumes();
    });

    Array.prototype.forEach.call(doc.querySelectorAll('[data-action="logout"]'), function (button) {
      button.addEventListener('click', function () { logout(button); });
    });

    /* Back button after logout must not show a stale signed-in page. */
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) {
        Auth.me().then(function (result) { if (!result.ok) { Auth.goToAuth('/dashboard.html'); } });
      }
    });
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
