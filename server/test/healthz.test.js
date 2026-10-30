const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../app');
const { pool } = require('./helpers');

after(() => pool.end());

test('GET /healthz returns ok and is not cached', async () => {
  const res = await request(createApp()).get('/healthz');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
  assert.equal(res.headers['cache-control'], 'no-store');
});