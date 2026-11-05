const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Everything below reads process.env at require time, so it loads after dotenv.
const logger = require('./logger');
const { pool } = require('./db/pool');
const { createApp } = require('./app');

let app;
try {
  app = createApp();
} catch (err) {
  logger.fatal(err.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

pool
  .query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => logger.info({ port: PORT }, 'Server listening'));
  })
  .catch((err) => {
    logger.fatal({ err }, 'Postgres connection failed');
    process.exit(1);
  });
