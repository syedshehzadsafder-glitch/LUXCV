'use strict';
/* STAND-IN server for browser tests only. It follows the same HTTP contract as
   server/ (same routes, status codes, cookie, ?next= redirect, gate rules via
   the real utils/pathGuard) but keeps data in memory and needs no packages.
   It does NOT exercise the real Express/Mongo code. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalise, classify } = require('../../server/utils/pathGuard');
const v = require('../../server/utils/validate');
const csp = require('../../server/utils/csp');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const PROTECTED = path.join(__dirname, '..', '..', 'protected');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

function create() {
  const users = []; const resumes = []; const sessions = new Map();
  const seq = (() => { let n = 0; return () => 'id' + (++n).toString(16).padStart(22, '0'); })();
  const hash = (p) => crypto.createHash('sha256').update(p).digest('hex');
  const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });
  function addUser(name, email, password, role) {
    const u = { id: seq(), name, email, pw: hash(password), role: role || 'user', isActive: true, createdAt: new Date().toISOString() };
    users.push(u); return u;
  }
  addUser('Site Admin', 'admin@luxcv.test', 'Admin12345', 'admin');
  const log = [];

  function who(req) {
    const m = /(?:^|;\s*)luxcv_token=([^;]+)/.exec(req.headers.cookie || '');
    const uid = m && sessions.get(m[1]);
    const u = uid && users.find((x) => x.id === uid);
    return u ? (u.isActive ? { u } : { inactive: true }) : {};
  }
  const send = (res, code, obj, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra || {})); res.end(JSON.stringify(obj)); };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let json = {}; try { json = body ? JSON.parse(body) : {}; } catch (e) { /* ignore */ }
      log.push(req.method + ' ' + url.pathname);
      if (url.pathname.startsWith('/api/')) return api(req, res, url, json);
      return stat(req, res, url);
    });
  });

  function stat(req, res, url) {
    const clean = normalise(url.pathname);
    const level = clean && classify(clean);
    if (level) {
      const s = who(req);
      if (!s.u) {
        if (clean.endsWith('.html')) { res.writeHead(302, { Location: '/auth.html?next=' + encodeURIComponent(req.url) }); return res.end(); }
        res.writeHead(401); return res.end('Authentication required');
      }
      if (level === 'admin' && s.u.role !== 'admin') {
        if (clean.endsWith('.html')) { res.writeHead(302, { Location: '/dashboard.html' }); return res.end(); }
        res.writeHead(403); return res.end('Forbidden');
      }
    }
    // Like the real app: gated files come ONLY from /protected, everything else from /public.
    const root = level ? PROTECTED : PUBLIC;
    let file = path.join(root, level ? clean : decodeURIComponent(url.pathname));
    if (url.pathname === '/') file = path.join(PUBLIC, 'index.html');
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Security-Policy': csp.headerValue(), 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': level ? 'private, no-store' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }

  function api(req, res, url, j) {
    const p = url.pathname; const m = req.method;
    if (m !== 'GET' && req.headers['x-requested-with'] !== 'luxcv') return send(res, 403, { message: 'csrf', code: 'CSRF' });
    const cookie = (t, max) => 'luxcv_token=' + t + '; Path=/; HttpOnly; SameSite=Lax' + (max === 0 ? '; Max-Age=0' : '');

    if (p === '/api/auth/register' && m === 'POST') {
      const { values, errors } = v.validateRegistration(j);
      if (Object.keys(errors).length) return send(res, 400, { message: 'fix', errors });
      if (users.some((u) => u.email === values.email)) return send(res, 409, { message: 'An account with this email already exists.', errors: { email: 'exists' } });
      const u = addUser(values.name, values.email, values.password, 'user');
      const t = crypto.randomBytes(12).toString('hex'); sessions.set(t, u.id);
      return send(res, 201, { user: pub(u) }, { 'Set-Cookie': cookie(t) });
    }
    if (p === '/api/auth/login' && m === 'POST') {
      const { values, errors } = v.validateLogin(j);
      if (Object.keys(errors).length) return send(res, 400, { message: 'fix', errors });
      const u = users.find((x) => x.email === values.email);
      if (!u || u.pw !== hash(values.password)) return send(res, 401, { message: 'Incorrect email or password.' });
      if (!u.isActive) return send(res, 403, { message: 'This account has been deactivated. Please contact the administrator.', code: 'ACCOUNT_INACTIVE' });
      const t = crypto.randomBytes(12).toString('hex'); sessions.set(t, u.id);
      return send(res, 200, { user: pub(u) }, { 'Set-Cookie': cookie(t) });
    }
    if (p === '/api/auth/logout' && m === 'POST') {
      const mm = /luxcv_token=([^;]+)/.exec(req.headers.cookie || ''); if (mm) sessions.delete(mm[1]);
      return send(res, 200, { message: 'Logged out.' }, { 'Set-Cookie': cookie('', 0) });
    }
    const s = who(req);
    if (!s.u) return send(res, 401, { message: s.inactive ? 'This account has been deactivated.' : 'Please log in to continue.', code: s.inactive ? 'ACCOUNT_INACTIVE' : 'UNAUTHENTICATED' });
    const me = s.u;
    if (p === '/api/auth/me') return send(res, 200, { user: pub(me) });

    if (p.startsWith('/api/admin/')) {
      if (me.role !== 'admin') return send(res, 403, { message: 'Administrator access required.', code: 'FORBIDDEN' });
      if (p === '/api/admin/users' && m === 'GET') {
        const q = (url.searchParams.get('q') || '').toLowerCase(); const st = url.searchParams.get('status');
        let list = users.filter((u) => (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)) && (!st || (st === 'active') === u.isActive));
        return send(res, 200, {
          users: list.map((u) => ({ id: u.id, username: u.name, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt, resumeCount: resumes.filter((r) => r.owner === u.id).length })),
          total: list.length, page: 1, pages: 1,
          stats: { total: users.length, active: users.filter((u) => u.isActive).length, inactive: users.filter((u) => !u.isActive).length, admins: users.filter((u) => u.role === 'admin').length }
        });
      }
      const mm = /^\/api\/admin\/users\/([^/]+)(\/status)?$/.exec(p);
      if (mm) {
        const t = users.find((u) => u.id === mm[1]); if (!t) return send(res, 404, { message: 'User not found.' });
        if (t.id === me.id) return send(res, 400, { message: 'You cannot change the status of your own account.' });
        if (mm[2] && m === 'PUT') { if (typeof j.isActive !== 'boolean') return send(res, 400, { message: 'bad' }); t.isActive = j.isActive; return send(res, 200, { user: pub(t) }); }
        if (!mm[2] && m === 'DELETE') {
          users.splice(users.indexOf(t), 1);
          const before = resumes.length; for (let i = resumes.length - 1; i >= 0; i--) if (resumes[i].owner === t.id) resumes.splice(i, 1);
          return send(res, 200, { message: 'User deleted.', deletedResumes: before - resumes.length });
        }
      }
      return send(res, 404, { message: 'Not found.' });
    }

    if (p.startsWith('/api/resumes')) {
      const mine = resumes.filter((r) => r.owner === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const sum = (r) => ({ id: r.id, title: r.title, templateId: r.templateId, updatedAt: r.updatedAt, createdAt: r.createdAt });
      if (p === '/api/resumes' && m === 'GET') return send(res, 200, { resumes: mine.map(sum) });
      if (p === '/api/resumes/latest') return send(res, 200, { resume: mine[0] || null });
      if (p === '/api/resumes' && m === 'POST') {
        const r = v.validateResumePayload(j); if (r.error) return send(res, 400, { message: r.error });
        const doc = { id: seq(), owner: me.id, title: r.title, templateId: r.templateId, data: r.data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        resumes.push(doc); return send(res, 201, { resume: doc });
      }
      const mm = /^\/api\/resumes\/([^/]+)$/.exec(p);
      if (mm) {
        const doc = resumes.find((r) => r.id === mm[1] && r.owner === me.id);   // ownership in the query
        if (!doc) return send(res, 404, { message: 'Resume not found.' });
        if (m === 'GET') return send(res, 200, { resume: doc });
        if (m === 'PUT') { const r = v.validateResumePayload(j); if (r.error) return send(res, 400, { message: r.error }); Object.assign(doc, { title: r.title, templateId: r.templateId, data: r.data, updatedAt: new Date().toISOString() }); return send(res, 200, { resume: doc }); }
        if (m === 'DELETE') { resumes.splice(resumes.indexOf(doc), 1); return send(res, 200, { message: 'Resume deleted.' }); }
      }
    }
    return send(res, 404, { message: 'Not found.' });
  }

  return { server, users, resumes, sessions, log, addUser };
}
module.exports = { create };
