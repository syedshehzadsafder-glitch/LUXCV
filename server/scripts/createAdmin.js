'use strict';

/* Creates an administrator, or promotes an existing account to admin.
   There is deliberately no public way to become an admin.

   Usage:
     npm run create-admin -- --email admin@example.com --name "Site Admin" --password "S3cretpass1"
   or with environment variables ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD. */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const { validateRegistration } = require('../utils/validate');

function arg(name) {
  const index = process.argv.indexOf('--' + name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = (arg('email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const name = (arg('name') || process.env.ADMIN_NAME || 'Administrator').trim();
  const password = arg('password') || process.env.ADMIN_PASSWORD || '';

  if (!email) {
    console.error('Provide --email (and --password for a new account).');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  const existing = await User.findOne({ email }).select('+password');

  if (existing) {
    existing.role = 'admin';
    existing.isActive = true;
    if (password) {
      const check = validateRegistration({ name: existing.name, email, password, confirmPassword: password });
      if (check.errors.password) throw new Error(check.errors.password);
      existing.password = await bcrypt.hash(password, 12);
    }
    await existing.save();
    console.log(`Existing account ${email} is now an active admin.`);
  } else {
    const check = validateRegistration({ name, email, password, confirmPassword: password });
    if (Object.keys(check.errors).length) {
      throw new Error(Object.values(check.errors).join(' '));
    }
    await User.create({
      name: check.values.name,
      email,
      password: await bcrypt.hash(password, 12),
      role: 'admin'
    });
    console.log(`Admin ${email} created.`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Failed:', error.message);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(1);
});
