'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

function cookieOptions() {
  return {
    httpOnly: true,                 // JavaScript can never read the token
    secure: config.cookieSecure,    // HTTPS only in production
    sameSite: 'lax',                // not sent on cross-site POSTs
    path: '/'
  };
}

function setAuthCookie(res, user) {
  // Only the user id travels in the token. Role and active state are always
  // re-read from the database, so deactivation and demotion apply instantly.
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256'
  });
  res.cookie(config.cookieName, token, { ...cookieOptions(), maxAge: config.cookieMaxAgeMs });
}

function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, cookieOptions());
}

function verify(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
}

module.exports = { setAuthCookie, clearAuthCookie, verify };
