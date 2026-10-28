'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(value) {
  return typeof value === 'string' ? value : '';
}

function checkPassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  // bcrypt only uses the first 72 bytes; refuse longer input instead of silently truncating.
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be 72 bytes or fewer.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return '';
}

/* Returns { values, errors } where errors is { field: message }. */
function validateRegistration(body) {
  const errors = {};
  const name = str(body.name).trim().replace(/\s+/g, ' ');
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  const confirmPassword = str(body.confirmPassword);

  if (name.length < 2) errors.name = 'Please enter your full name (at least 2 characters).';
  else if (name.length > 60) errors.name = 'Name must be 60 characters or fewer.';

  if (!email) errors.email = 'Please enter your email address.';
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';

  const passwordProblem = checkPassword(password);
  if (passwordProblem) errors.password = passwordProblem;

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

  return { values: { name, email, password }, errors };
}

function validateLogin(body) {
  const errors = {};
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  if (!email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
  if (!password) errors.password = 'Please enter your password.';
  return { values: { email, password }, errors };
}

/* Rejects keys that could be abused in MongoDB ($operators, dotted paths,
   prototype pollution) anywhere inside user-supplied data. */
function hasForbiddenKeys(value, depth) {
  const level = depth || 0;
  if (level > 12) return true;
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenKeys(item, level + 1));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).some((key) => {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return true;
      }
      return hasForbiddenKeys(value[key], level + 1);
    });
  }
  return false;
}

const MAX_RESUME_BYTES = 900 * 1024;

function validateResumePayload(body) {
  const templateId = str(body.templateId).trim();
  const data = body.data;
  if (!templateId || templateId.length > 60 || !/^[a-z0-9-]+$/i.test(templateId)) {
    return { error: 'A valid templateId is required.' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'Resume data must be an object.' };
  }
  if (hasForbiddenKeys(data)) {
    return { error: 'Resume data contains unsupported keys.' };
  }
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_RESUME_BYTES) {
    return { error: 'Resume is too large to save.' };
  }
  const fullName = data.personal && typeof data.personal.fullName === 'string' ? data.personal.fullName.trim() : '';
  const title = (fullName ? fullName + ' - resume' : 'Untitled resume').slice(0, 120);
  return { templateId, data, title };
}

module.exports = { validateRegistration, validateLogin, validateResumePayload, hasForbiddenKeys };
