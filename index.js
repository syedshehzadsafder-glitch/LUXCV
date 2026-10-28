'use strict';

// Entry point Vercel detects for Express: it must export the app (not call listen).
// Locally, `npm start` runs server/server.js, which listens on a port instead.
module.exports = require('./server/app');
