/* ==========================================================================
   LUXCV - app.js
   Shared behaviour for every page (navigation, FAQ accordion, scroll reveal,
   footer year) and the single entry point that starts page controllers.
   Loaded last, with `defer`, so every other module has registered already.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var doc = document;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function qs(selector, root) {
    return (root || doc).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(selector));
  }

  function onMediaChange(query, handler) {
    if (query.addEventListener) {
      query.addEventListener('change', handler);
    } else if (query.addListener) {
      query.addListener(handler);
    }
  }

  /* ----- Navigation: mobile menu + header state ----- */
  function initNav() {
    var header = qs('.site-header');
    var toggle = qs('.nav__toggle');
    var menu = qs('#primary-menu');
    if (!header || !toggle || !menu) {
      return;
    }

    var desktop = window.matchMedia('(min-width: 48em)');

    function isOpen() {
      return menu.classList.contains('is-open');
    }

    function setOpen(open, returnFocus) {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close main menu' : 'Open main menu');
      if (!open && returnFocus) {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false, true);
      }
    });

    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        setOpen(false);
      }
    });

    doc.addEventListener('click', function (event) {
      if (isOpen() && !header.contains(event.target)) {
        setOpen(false);
      }
    });

    onMediaChange(desktop, function () {
      if (desktop.matches) {
        setOpen(false);
      }
    });

    function updateScrolled() {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    }

    window.addEventListener('scroll', updateScrolled, { passive: true });
    updateScrolled();
  }

  /* ----- Navigation: highlight the section being read (in-page links) ----- */
  function initScrollSpy() {
    var links = qsa('.nav__link[href^="#"]');
    var sections = qsa('main section[id]');
    if (!links.length || !sections.length || !('IntersectionObserver' in window)) {
      return;
    }

    var linkById = {};
    links.forEach(function (link) {
      linkById[link.getAttribute('href').slice(1)] = link;
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          links.forEach(function (link) {
            link.classList.remove('is-active');
            link.removeAttribute('aria-current');
          });
          var active = linkById[entry.target.id];
          if (active) {
            active.classList.add('is-active');
            active.setAttribute('aria-current', 'location');
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ----- FAQ accordion ----- */
  function initFaq() {
    qsa('.faq').forEach(function (faq) {
      var triggers = qsa('.faq__trigger', faq);

      triggers.forEach(function (trigger, index) {
        trigger.addEventListener('click', function () {
          var expanded = trigger.getAttribute('aria-expanded') === 'true';
          trigger.setAttribute('aria-expanded', String(!expanded));
          trigger.closest('.faq__item').classList.toggle('is-open', !expanded);
        });

        trigger.addEventListener('keydown', function (event) {
          var target = null;
          if (event.key === 'ArrowDown') {
            target = triggers[(index + 1) % triggers.length];
          } else if (event.key === 'ArrowUp') {
            target = triggers[(index - 1 + triggers.length) % triggers.length];
          } else if (event.key === 'Home') {
            target = triggers[0];
          } else if (event.key === 'End') {
            target = triggers[triggers.length - 1];
          }
          if (target) {
            event.preventDefault();
            target.focus();
          }
        });
      });
    });
  }

  /* ----- Scroll reveal ----- */
  function initReveal() {
    var items = qsa('.reveal');
    if (!items.length) {
      return;
    }

    function show(element) {
      element.classList.add('is-visible');
    }

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach(show);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            show(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  /* ----- Footer year ----- */
  function initYear() {
    var year = String(new Date().getFullYear());
    qsa('[data-year]').forEach(function (element) {
      element.textContent = year;
    });
  }

  /* ----- Entry point ----- */
  function init() {
    initNav();
    initScrollSpy();
    initFaq();
    initReveal();
    initYear();

    var page = doc.body.getAttribute('data-page');
    if (page === 'templates' && LuxCV.Gallery) {
      LuxCV.Gallery.init();
    }
    if (page === 'builder' && LuxCV.Builder) {
      /* The builder starts only after the server confirms the session and the
         account's saved resume has been loaded (cloud-sync.js). */
      if (LuxCV.Cloud) {
        LuxCV.Cloud.boot().then(function (ready) {
          if (ready) {
            LuxCV.Builder.init();
            LuxCV.Cloud.attach();
          }
        });
      } else {
        LuxCV.Builder.init();
      }
    }
  }

  LuxCV.App = { init: init };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
