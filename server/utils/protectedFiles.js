'use strict';

const fs = require('fs');
const path = require('path');

const HTML = 'text/html; charset=utf-8';
const JS = 'application/javascript; charset=utf-8';

const files = new Map([
  ['/builder.html', { type: HTML, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'builder.html')) }],
  ['/dashboard.html', { type: HTML, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'dashboard.html')) }],
  ['/admin.html', { type: HTML, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'admin.html')) }],
  ['/js/builder.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'builder.js')) }],
  ['/js/editor-form.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'editor-form.js')) }],
  ['/js/appearance.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'appearance.js')) }],
  ['/js/validation.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'validation.js')) }],
  ['/js/pdf-export.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'pdf-export.js')) }],
  ['/js/pdf-download.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'pdf-download.js')) }],
  ['/js/cloud-sync.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'cloud-sync.js')) }],
  ['/js/dashboard.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'dashboard.js')) }],
  ['/js/admin.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'admin.js')) }],
  ['/js/vendor/html2canvas.min.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'vendor', 'html2canvas.min.js')) }],
  ['/js/vendor/jspdf.umd.min.js', { type: JS, body: fs.readFileSync(path.join(__dirname, '..', '..', 'protected', 'js', 'vendor', 'jspdf.umd.min.js')) }],
]);

module.exports = files;