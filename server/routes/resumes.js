'use strict';

const express = require('express');
const mongoose = require('mongoose');
const config = require('../config');
const Resume = require('../models/Resume');
const { protect } = require('../middleware/auth');
const { validateResumePayload } = require('../utils/validate');

const router = express.Router();

// Every route below needs a logged-in user.
router.use(protect);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function summary(doc) {
  return { id: String(doc._id), title: doc.title, templateId: doc.templateId, updatedAt: doc.updatedAt, createdAt: doc.createdAt };
}

/* Ownership is part of every query: someone else's id behaves exactly like an
   id that does not exist (404), so ids cannot be probed. */
async function findOwned(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ message: 'Resume not found.' });
    return null;
  }
  const doc = await Resume.findOne({ _id: id, owner: req.user._id });
  if (!doc) {
    res.status(404).json({ message: 'Resume not found.' });
    return null;
  }
  return doc;
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await Resume.find({ owner: req.user._id }).select('title templateId updatedAt createdAt').sort({ updatedAt: -1 });
    res.json({ resumes: docs.map(summary) });
  } catch (error) { next(error); }
});

// Most recently edited resume (what the builder opens by default).
router.get('/latest', async (req, res, next) => {
  try {
    const doc = await Resume.findOne({ owner: req.user._id }).sort({ updatedAt: -1 });
    res.json({ resume: doc ? doc.toJSON() : null });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = validateResumePayload(req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const count = await Resume.countDocuments({ owner: req.user._id });
    if (count >= config.maxResumesPerUser) {
      return res.status(400).json({ message: `You can keep up to ${config.maxResumesPerUser} saved resumes. Delete one first.` });
    }
    const doc = await Resume.create({
      owner: req.user._id,   // always the logged-in user, never taken from the body
      title: parsed.title,
      templateId: parsed.templateId,
      data: parsed.data
    });
    res.status(201).json({ resume: doc.toJSON() });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await findOwned(req, res);
    if (doc) res.json({ resume: doc.toJSON() });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const parsed = validateResumePayload(req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const doc = await findOwned(req, res);
    if (!doc) return;
    doc.title = parsed.title;
    doc.templateId = parsed.templateId;
    doc.data = parsed.data;
    doc.markModified('data');
    await doc.save();
    res.json({ resume: doc.toJSON() });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await findOwned(req, res);
    if (!doc) return;
    await doc.deleteOne();
    res.json({ message: 'Resume deleted.' });
  } catch (error) { next(error); }
});

module.exports = router;
