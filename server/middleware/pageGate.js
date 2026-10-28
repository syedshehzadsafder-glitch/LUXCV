'use strict';

/* Server-side gate for the builder, dashboard, admin page and the scripts that
   power them. These files live in /protected (NOT /public), so no static file
   server or CDN can ever hand them out; the only way to receive one is to pass
   this middleware, which checks the session and then sends the file itself.

   This matters on Vercel: files in /public are served by the CDN before Express
   runs, so anything left there would bypass the login check entirely.
   See utils/pathGuard.js for which paths are covered. */

const path = require('path');
const { resolveUser } = require('./auth');
const { clearAuthCookie } = require('../utils/token');
const { normalise, classify } = require('../utils/pathGuard');

const PROTECTED_DIR = path.join(__dirname, '..', '..', 'protected');

module.exports = async function pageGate(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const clean = normalise(req.path);
  if (clean === null) return res.status(400).send('Bad request');

  const level = classify(clean);
  if (!level) return next();
  const isPage = clean.endsWith('.html');

  try {
    const { user, reason } = await resolveUser(req);
    res.set('Cache-Control', 'private, no-store');

    if (!user) {
      if (reason !== 'missing') clearAuthCookie(res);
      if (isPage) {
        return res.redirect(302, '/auth.html?next=' + encodeURIComponent(req.originalUrl));
      }
      return res.status(401).type('text/plain').send('Authentication required');
    }
    if (level === 'admin' && user.role !== 'admin') {
      if (isPage) return res.redirect(302, '/dashboard.html');
      return res.status(403).type('text/plain').send('Forbidden');
    }
    req.user = user;
    return res.sendFile(clean.slice(1), { root: PROTECTED_DIR, dotfiles: 'deny' }, (error) => {
      if (error && !res.headersSent) next(); // not a real file: fall through to 404
    });
  } catch (error) {
    return next(error);
  }
};
