const { pool } = require('../db/pool');

const url = process.env.DATABASE_URL;
const dbName = url ? new URL(url).pathname.slice(1) : '(DATABASE_URL not set)';
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run tests against database "${dbName}"`);
}

async function resetDb() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

module.exports = { pool, resetDb };