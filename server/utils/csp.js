'use strict';

const crypto = require('crypto');

// Every page has this one inline script (adds the "js" class). A hash lets the
// CSP allow exactly that script and nothing else inline.
const JS_CLASS_SCRIPT = "document.documentElement.classList.add('js');";
const JS_CLASS_HASH = "'sha256-" + crypto.createHash('sha256').update(JS_CLASS_SCRIPT).digest('base64') + "'";

const directives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", JS_CLASS_HASH],
  // The existing pages use inline style="--i: 1" attributes.
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"]
};

function headerValue() {
  return Object.keys(directives).map((k) => k + ' ' + directives[k].join(' ')).join('; ');
}

module.exports = { directives, headerValue };
