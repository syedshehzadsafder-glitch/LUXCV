'use strict';

/* Decides which static files need a session. Kept free of dependencies so it
   can be unit-tested on its own.

   The path is decoded, normalised and lower-cased before matching, so
   /BUILDER.HTML, /%62uilder.html and /js/../builder.html cannot slip past on
   case-insensitive file systems. */

const path = require('path');

const USER_PAGES = new Set(['/builder.html', '/dashboard.html']);
const USER_ASSETS = [
  /^\/js\/(builder|editor-form|appearance|validation|pdf-export|pdf-download|cloud-sync|dashboard)\.js$/,
  /^\/js\/vendor\//
];
const ADMIN_FILES = new Set(['/admin.html', '/js/admin.js']);

function normalise(rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch (error) {
    return null;
  }
  if (decoded.includes('\0')) return null;
  let clean = path.posix.normalize(decoded.replace(/\\/g, '/')).toLowerCase();
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
  return clean;
}

/* Returns 'admin', 'user' or '' (public). */
function classify(clean) {
  if (ADMIN_FILES.has(clean)) return 'admin';
  if (USER_PAGES.has(clean) || USER_ASSETS.some((re) => re.test(clean))) return 'user';
  return '';
}

module.exports = { normalise, classify };
