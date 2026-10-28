'use strict';

const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');
const { verify, clearAuthCookie } = require('../utils/token');

/* Resolves the logged-in user from the cookie, or returns { user: null, reason }. */
async function resolveUser(req) {
  const token = req.cookies && req.cookies[config.cookieName];
  if (!token) return { user: null, reason: 'missing' };

  let payload;
  try {
    payload = verify(token);
  } catch (error) {
    return { user: null, reason: 'invalid' };
  }
  if (!payload || !mongoose.isValidObjectId(payload.sub)) return { user: null, reason: 'invalid' };

  const user = await User.findById(payload.sub);
  if (!user) return { user: null, reason: 'invalid' };
  if (!user.isActive) return { user: null, reason: 'inactive' };
  return { user, reason: '' };
}

/* protect: any valid, active, logged-in user. */
async function protect(req, res, next) {
  try {
    const { user, reason } = await resolveUser(req);
    if (!user) {
      if (reason !== 'missing') clearAuthCookie(res);
      return res.status(401).json({
        message: reason === 'inactive' ? 'This account has been deactivated.' : 'Please log in to continue.',
        code: reason === 'inactive' ? 'ACCOUNT_INACTIVE' : 'UNAUTHENTICATED'
      });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/* isAdmin: must run after protect. */
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access required.', code: 'FORBIDDEN' });
  }
  return next();
}

/* The chain the admin routes use: protect, then isAdmin. */
const adminAuthMiddleware = [protect, isAdmin];

module.exports = { protect, isAdmin, adminAuthMiddleware, resolveUser };
