'use strict';

const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Untitled resume', trim: true, maxlength: 120 },
    templateId: { type: String, required: true, maxlength: 60 },
    // The builder's own resume object (schema v4). Validated for size and key
    // safety in the route; the frontend re-cleans it with Data.migrateResume().
    data: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true, minimize: false }
);

resumeSchema.index({ owner: 1, updatedAt: -1 });

resumeSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = String(ret._id);
    ret.owner = String(ret.owner);
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Resume', resumeSchema);
