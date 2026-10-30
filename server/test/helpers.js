const request = require('supertest');
const { pool } = require('../db/pool');

const url = process.env.DATABASE_URL;
const dbName = url ? new URL(url).pathname.slice(1) : '(DATABASE_URL not set)';
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run tests against database "${dbName}"`);
}

async function resetDb() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

const PASSWORD = 'correct-horse-battery';

// Signs up a user through the API and returns { token, user, password }
async function createUser(app, overrides = {}) {
  const body = {
    username: 'lane',
    email: 'lane@example.com',
    password: PASSWORD,
    ...overrides,
  };
  const res = await request(app).post('/api/auth/signup').send(body);
  if (res.status !== 201) {
    throw new Error(`createUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user, password: body.password };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { pool, resetDb, createUser, bearer, PASSWORD };