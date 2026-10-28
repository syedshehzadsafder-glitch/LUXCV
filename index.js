'use strict';

// Vercel looks for an entry file that imports express directly,
// so this line must stay even though the app is built in server/app.js.
const express = require('express'); // eslint-disable-line no-unused-vars

const app = require('./server/app');

// Export the app (don't call listen). Locally, npm start uses server/server.js.
module.exports = app;