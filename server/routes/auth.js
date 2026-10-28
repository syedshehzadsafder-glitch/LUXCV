'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { setAuthCookie, clearAuthCookie } = require('../utils/token');
const { validateRegistration, validateLogin } = require('../utils/validate');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

// Compared against when the email is unknown, so response time does not reveal
// which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('luxcv-dummy-password-1', BCRYPT_ROUNDS);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' }
});

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { values, errors } = validateRegistration(req.body || {});
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });
    }

    if (await User.exists({ email: values.email })) {
      return res.status(409).json({
        message: 'An account with this email already exists. Try logging in instead.',
        errors: { email: 'An account with this email already exists.' }
      });
    }

    const hash = await bcrypt.hash(values.password, BCRYPT_ROUNDS);
    // role is never read from the request: every public registration is a normal user.
    const user = await User.create({ name: values.name, email: values.email, password: hash, role: 'user' });

    user.lastLoginAt = new Date();
    await user.save();
    setAuthCookie(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email already exists. Try logging in instead.',
        errors: { email: 'An account with this email already exists.' }
      });
    }
    return next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { values, errors } = validateLogin(req.body || {});
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });
    }

    const user = await User.findOne({ email: values.email }).select('+password');
    const matches = await bcrypt.compare(values.password, user ? user.password : DUMMY_HASH);
    if (!user || !matches) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    // Only revealed after the password is right, so it cannot be used to probe emails.
    if (!user.isActive) {
      return res.status(403).json({
        message: 'This account has been deactivated. Please contact the administrator.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    user.lastLoginAt = new Date();
    await user.save();
    setAuthCookie(res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

// Works with or without a valid session: it only clears the cookie.
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.set('Cache-Control', 'no-store');
  res.json({ message: 'Logged out.' });
});

router.get('/me', protect, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
