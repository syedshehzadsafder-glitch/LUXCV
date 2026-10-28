/* ==========================================================================
   LUXCV - dom.js
   Small, safe DOM helpers. Everything the user types is inserted with
   textContent or setAttribute, never innerHTML, so entered HTML or script is
   always shown as plain text and never runs.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  /* Attributes whose values are URLs or handlers must never come from user
     input, so they are refused outright. */
  var BLOCKED = /^on/i;

  /* el('button', { class: 'btn', type: 'button', text: 'Save', dataset: {id: 1} }, [children])
     Children may be nodes, strings (added as text) or null/false (skipped). */
  function el(tag, props, children) {
    var node = document.createElement(tag);
    var attrs = props || {};

    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value === undefined || value === null || value === false || BLOCKED.test(key)) {
        return;
      }
      if (key === 'text') {
        node.textContent = value;
      } else if (key === 'class') {
        node.className = value;
      } else if (key === 'dataset') {
        Object.keys(value).forEach(function (name) {
          node.dataset[name] = value[name];
        });
      } else if (value === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(value));
      }
    });

    append(node, children);
    return node;
  }

  function append(parent, children) {
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child === null || child === undefined || child === false) {
        return;
      }
      parent.appendChild(typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child);
    });
    return parent;
  }

  function clear(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
    return node;
  }

  function debounce(fn, wait) {
    var timer = 0;
    function debounced() {
      var args = arguments;
      var self = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    }
    debounced.flush = function () {
      window.clearTimeout(timer);
    };
    return debounced;
  }

  LuxCV.Dom = { el: el, append: append, clear: clear, debounce: debounce };
})();
