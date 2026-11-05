const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const logger = require('../logger');

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected Postgres pool error');
});


async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };