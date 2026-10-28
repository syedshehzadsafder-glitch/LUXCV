'use strict';

/* Cookie auth needs CSRF protection for anything that changes data. The
   frontend always sends a custom header; browsers will not let another site
   add it without a CORS preflight, and this server does not enable CORS.
   SameSite=Lax on the cookie is a second layer. */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = function csrfGuard(req, res, next) {
  if (SAFE.has(req.method)) return next();
  if (req.get('X-Requested-With') !== 'luxcv') {
    return res.status(403).json({ message: 'Request blocked (missing security header).', code: 'CSRF' });
  }
  const origin = req.get('Origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (error) { host = ''; }
    if (host !== req.get('Host')) {
      return res.status(403).json({ message: 'Request blocked (cross-site).', code: 'CSRF' });
    }
  }
  return next();
};
