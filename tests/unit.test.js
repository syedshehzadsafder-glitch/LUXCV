'use strict';
// Dependency-free unit tests:  node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const { normalise, classify } = require('../server/utils/pathGuard');
const v = require('../server/utils/validate');

const level = (p) => classify(normalise(p));

test('public files stay public', () => {
  for (const p of ['/', '/index.html', '/templates.html', '/auth.html', '/css/base.css', '/js/gallery.js', '/js/auth-client.js', '/js/data-model.js', '/assets/icons/logo-mark.svg']) {
    assert.strictEqual(level(p), '', p);
  }
});

test('builder, dashboard and their scripts need a user', () => {
  for (const p of ['/builder.html', '/dashboard.html', '/js/builder.js', '/js/editor-form.js', '/js/pdf-download.js', '/js/pdf-export.js', '/js/cloud-sync.js', '/js/vendor/jspdf.umd.min.js', '/js/vendor/html2canvas.min.js']) {
    assert.strictEqual(level(p), 'user', p);
  }
});

test('admin files need an admin', () => {
  assert.strictEqual(level('/admin.html'), 'admin');
  assert.strictEqual(level('/js/admin.js'), 'admin');
});

test('bypass attempts are still gated', () => {
  const tricks = ['/BUILDER.HTML', '/Builder.Html', '/%62uilder.html', '/js/../builder.html', '/js/./builder.js', '//builder.html', '/JS/Vendor/jspdf.umd.min.js', '/js/vendor/../vendor/html2canvas.min.js', '/builder.html/', '\\builder.html'];
  for (const p of tricks) assert.strictEqual(level(p), 'user', p);
  assert.strictEqual(level('/ADMIN.html'), 'admin');
  assert.strictEqual(level('/%61dmin.html'), 'admin');
  assert.strictEqual(normalise('/%E0%A4%A'), null);      // malformed encoding rejected
  assert.strictEqual(normalise('/builder.html%00.css'), null); // NUL rejected
});

test('registration validation', () => {
  const ok = v.validateRegistration({ name: 'Ada Lovelace', email: ' ADA@Example.com ', password: 'abcdefg1', confirmPassword: 'abcdefg1' });
  assert.deepStrictEqual(ok.errors, {});
  assert.strictEqual(ok.values.email, 'ada@example.com');

  const bad = v.validateRegistration({ name: 'A', email: 'nope', password: 'short', confirmPassword: 'x' });
  assert.deepStrictEqual(Object.keys(bad.errors).sort(), ['confirmPassword', 'email', 'name', 'password']);

  assert.ok(v.validateRegistration({ name: 'Ada', email: 'a@b.co', password: 'abcdefgh', confirmPassword: 'abcdefgh' }).errors.password); // no number
  assert.ok(v.validateRegistration({ name: 'Ada', email: 'a@b.co', password: 'a1'.repeat(40), confirmPassword: 'a1'.repeat(40) }).errors.password); // >72 bytes
  assert.ok(v.validateRegistration({ name: 'Ada', email: 'a@b.co', password: 'abcdefg1', confirmPassword: 'abcdefg2' }).errors.confirmPassword);
});

test('non-string input cannot reach queries (NoSQL injection)', () => {
  const r = v.validateLogin({ email: { $gt: '' }, password: { $ne: null } });
  assert.ok(r.errors.email && r.errors.password);
  assert.strictEqual(r.values.email, '');
});

test('resume payload validation', () => {
  assert.ok(v.validateResumePayload({ templateId: 'executive-gold', data: { personal: { fullName: 'Ada' } } }).title.startsWith('Ada'));
  assert.ok(v.validateResumePayload({ templateId: '../x', data: {} }).error);
  assert.ok(v.validateResumePayload({ templateId: 'a', data: [] }).error);
  assert.ok(v.validateResumePayload({ templateId: 'a', data: { $where: 'x' } }).error);
  assert.ok(v.validateResumePayload({ templateId: 'a', data: { a: { 'b.c': 1 } } }).error);
  assert.ok(v.validateResumePayload({ templateId: 'a', data: JSON.parse('{"__proto__":{"x":1}}') }).error);
  assert.ok(v.validateResumePayload({ templateId: 'a', data: { big: 'x'.repeat(1000 * 1024) } }).error);
});
