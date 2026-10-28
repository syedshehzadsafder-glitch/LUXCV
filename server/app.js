'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = require('./config');
const csp = require('./utils/csp');
const db = require('./db');
const csrfGuard = require('./middleware/csrf');
const pageGate = require('./middleware/pageGate');
const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resumes');
const adminRoutes = require('./routes/admin');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');


const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: csp.directives
    },
    crossOriginEmbedderPolicy: false
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

/* Make sure MongoDB is connected before any route runs (cached, so cheap). */
app.use(async (req, res, next) => {
  try {
    await db.connect();
    next();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    res.status(503).type('text/plain').send('Service temporarily unavailable');
  }
});

/* ----- API ----- */
app.use('/api', csrfGuard);
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

/* ----- Frontend ----- */
app.use(pageGate); // /protected files: builder, dashboard, admin + their scripts (need a session)
// Locally Express serves /public. On Vercel the CDN serves /public instead and this line is ignored.
app.use(
  express.static(PUBLIC_DIR, {
    dotfiles: 'ignore',
    index: 'index.html',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'private, no-cache');
    }
  })
);

app.use((req, res) => {
  if (req.accepts('html')) return res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
  return res.status(404).type('text/plain').send('Not found');
});

/* eslint-disable-next-line no-unused-vars */
app.use((error, req, res, next) => {
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON.' });
  }
  if (error && error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request is too large.' });
  }
  console.error(error);
  if (req.path.startsWith('/api')) return res.status(500).json({ message: 'Something went wrong on the server.' });
  return res.status(500).type('text/plain').send('Server error');
});

module.exports = app;
