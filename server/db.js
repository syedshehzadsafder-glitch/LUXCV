'use strict';

/* One MongoDB connection, reused. On Vercel every request may run in a warm
   instance that already has a connection, or a cold one that needs it; caching
   the promise avoids opening a new connection per request. */
const mongoose = require('mongoose');
const config = require('./config');

let cached = global.__luxcvMongo;
if (!cached) {
  cached = global.__luxcvMongo = { promise: null };
}

function connect() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .catch((error) => {
        cached.promise = null; // let the next request try again
        throw error;
      });
  }
  return cached.promise;
}

module.exports = { connect };
