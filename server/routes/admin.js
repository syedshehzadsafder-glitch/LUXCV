'use strict';

const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Resume = require('../models/Resume');
const { adminAuthMiddleware } = require('../middleware/auth');

const router = express.Router();

// protect + isAdmin for every /api/admin/* route.
router.use(adminAuthMiddleware);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function adminView(user, resumeCounts) {
  return {
    id: String(user._id),
    username: user.name,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    resumeCount: resumeCounts ? resumeCounts[String(user._id)] || 0 : undefined
  };
}

async function loadTarget(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'User not found.' });
    return null;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return null;
  }
  return user;
}

/* Never allow the system to end up with no active administrator. */
async function isLastActiveAdmin(user) {
  if (user.role !== 'admin' || !user.isActive) return false;
  const others = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
  return others === 0;
}

// GET /api/admin/users?page=1&limit=20&q=text&status=active|inactive
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};

    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;

    const [total, users, totalUsers, activeUsers, admins] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'admin' })
    ]);

    const counts = {};
    if (users.length) {
      const rows = await Resume.aggregate([
        { $match: { owner: { $in: users.map((u) => u._id) } } },
        { $group: { _id: '$owner', n: { $sum: 1 } } }
      ]);
      rows.forEach((row) => { counts[String(row._id)] = row.n; });
    }

    res.json({
      users: users.map((u) => adminView(u, counts)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: { total: totalUsers, active: activeUsers, inactive: totalUsers - activeUsers, admins }
    });
  } catch (error) { next(error); }
});

// PUT /api/admin/users/:id/status   body: { isActive: true | false }
router.put('/users/:id/status', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be true or false.' });
    }
    const user = await loadTarget(req, res);
    if (!user) return;

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot change the status of your own account.' });
    }
    if (!req.body.isActive && (await isLastActiveAdmin(user))) {
      return res.status(400).json({ message: 'You cannot deactivate the last active administrator.' });
    }

    user.isActive = req.body.isActive;
    await user.save();
    // Deactivation takes effect on the user's very next request: protect()
    // re-reads isActive from the database instead of trusting the token.
    res.json({ user: adminView(user) });
  } catch (error) { next(error); }
});

// DELETE /api/admin/users/:id  - removes the user and all of their resumes.
router.delete('/users/:id', async (req, res, next) => {
  try {
    const user = await loadTarget(req, res);
    if (!user) return;

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    if (await isLastActiveAdmin(user)) {
      return res.status(400).json({ message: 'You cannot delete the last active administrator.' });
    }

    // Account first, so the person is locked out at once; then their data.
    await User.deleteOne({ _id: user._id });
    const result = await Resume.deleteMany({ owner: user._id });
    res.json({ message: 'User deleted.', deletedResumes: result.deletedCount || 0 });
  } catch (error) { next(error); }
});

module.exports = router;
