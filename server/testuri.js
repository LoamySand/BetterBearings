// test-mongo.js
const mongoose = require('mongoose');

// DO NOT DEPLOY OR COMMIT WITH REAL PASSWORDS IN ENV VARS
const rawUri = process.env.MONGO_URI || '<NO_ENV>';
const show = rawUri === '<NO_ENV>' ? rawUri : rawUri.replace(/:(.*)@/, ':<REDACTED>@'); // hide password
console.log('Starting Mongo test. MONGO_URI (masked):', show);

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/backofyourhand';

const opts = {
  serverSelectionTimeoutMS: 5000 // fail fast (5s)
};

mongoose
  .connect(uri, opts)
  .then(() => {
    console.log('Connected to MongoDB');
    return mongoose.disconnect();
  })
  .then(() => {
    console.log('Disconnected and exiting');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Connection error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    process.exit(1);
  });