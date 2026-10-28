'use strict';

require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name} (see .env.example)`);
    process.exit(1);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const days = Number(process.env.JWT_EXPIRES_DAYS) || 7;

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  jwtExpiresIn: `${days}d`,
  cookieName: 'luxcv_token',
  cookieMaxAgeMs: days * 24 * 60 * 60 * 1000,
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : isProd,
  // Vercel always sits behind a proxy; without this every visitor shares one IP
  // (breaking the login rate limit) and req.secure is wrong.
  trustProxy: Number(process.env.TRUST_PROXY) || (process.env.VERCEL ? 1 : 0),
  maxResumesPerUser: 20
};
