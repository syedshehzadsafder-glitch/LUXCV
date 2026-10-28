/* ==========================================================================
   LUXCV - dialog.js
   Helpers for native <dialog> elements: open/close with scroll lock, focus
   return, backdrop click, and a promise-based confirmation dialog.
   The ".modal" styles live in components.css and are shared with the gallery.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var openCount = 0;

  function lock() {
    openCount += 1;
    document.documentElement.classList.add('is-modal-open');
  }

  function unlock() {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) {
      document.documentElement.classList.remove('is-modal-open');
    }
  }

  /* Wires a <dialog> once: backdrop click, [data-dialog-close] buttons, and
     returning focus to whatever opened it. */
  function setup(dialog) {
    if (!dialog || dialog.__luxcvReady) {
      return;
    }
    dialog.__luxcvReady = true;

    var pressedBackdrop = false;
    dialog.addEventListener('pointerdown', function (event) {
      pressedBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog && pressedBackdrop) {
        dialog.close('backdrop');
      }
      pressedBackdrop = false;
    });
    dialog.addEventListener('click', function (event) {
      var closer = event.target.closest ? event.target.closest('[data-dialog-close]') : null;
      if (closer && dialog.contains(closer)) {
        dialog.close(closer.getAttribute('data-dialog-close') || 'close');
      }
    });
    dialog.addEventListener('close', function () {
      unlock();
      var opener = dialog.__opener;
      dialog.__opener = null;
      if (opener && document.contains(opener) && typeof opener.focus === 'function') {
        opener.focus();
      }
    });
  }

  function open(dialog, opener) {
    if (!dialog || dialog.open) {
      return;
    }
    setup(dialog);
    dialog.__opener = opener || document.activeElement;
    lock();
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function close(dialog, value) {
    if (dialog && dialog.open) {
      dialog.close(value);
    }
  }

  /* Resolves true when the user confirms, false for cancel/Escape/backdrop.
     The dialog needs a [data-dialog-close="confirm"] button. */
  function confirm(dialog, opener) {
    return new Promise(function (resolve) {
      function done() {
        dialog.removeEventListener('close', done);
        resolve(dialog.returnValue === 'confirm');
      }
      dialog.returnValue = '';
      dialog.addEventListener('close', done);
      open(dialog, opener);
    });
  }

  LuxCV.Dialog = { setup: setup, open: open, close: close, confirm: confirm };
})();
