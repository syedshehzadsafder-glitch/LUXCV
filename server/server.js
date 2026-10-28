'use strict';

const mongoose = require('mongoose');
const config = require('./config');
const db = require('./db');
const app = require('./app');

async function start() {
  try {
    await db.connect();
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`LUXCV running at http://localhost:${config.port}`);
  });

  function shutdown() {
    server.close(() => mongoose.connection.close(false).then(() => process.exit(0)));
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
