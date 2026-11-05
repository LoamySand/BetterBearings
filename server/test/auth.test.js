const { describe, test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');
const { pool, resetDb, createUser, bearer, PASSWORD } = require('./helpers');

const app = createApp();

beforeEach(resetDb);
after(() => pool.end());

const signup = (body) => request(app).post('/api/auth/signup').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const me = (headers = {}) => request(app).get('/api/auth/me').set(headers);

describe('POST /api/auth/signup', () => {
  test('creates a user and returns a token', async () => {
    const res = await signup({ username: 'lane', email: 'lane@example.com', password: PASSWORD });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.deepEqual(res.body.user, { id: '1', username: 'lane', email: 'lane@example.com' });
  });

  test('normalizes email to trimmed lowercase', async () => {
    const res = await signup({
      username: 'lane',
      email: '  Lane@Example.COM ',
      password: PASSWORD,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'lane@example.com');
  });

  test('rejects a duplicate email', async () => {
    await createUser(app);
    const res = await signup({ username: 'other', email: 'lane@example.com', password: PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Email already registered');
  });

  test('rejects a username that differs only in case', async () => {
    await createUser(app);
    const res = await signup({ username: 'LANE', email: 'other@example.com', password: PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Username already taken');
  });

  test('rejects an 11-character password', async () => {
    const res = await signup({
      username: 'lane',
      email: 'lane@example.com',
      password: 'a'.repeat(11),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].path, 'password');
  });

  test('accepts 72 bytes and rejects 74 bytes of password', async () => {
    const ok = await signup({
      username: 'lane',
      email: 'lane@example.com',
      password: 'é'.repeat(36),
    });
    assert.equal(ok.status, 201);

    const tooLong = await signup({
      username: 'lane2',
      email: 'b@example.com',
      password: 'é'.repeat(37),
    });
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.message, 'Password is too long (72 bytes max)');
  });

  test('ignores unknown fields instead of rejecting them', async () => {
    const res = await signup({
      username: 'lane',
      email: 'lane@example.com',
      password: PASSWORD,
      isAdmin: true,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.isAdmin, undefined);
  });

  test('reports every invalid field', async () => {
    const res = await signup({ username: 'x', email: 'not-an-email', password: 'short' });
    assert.equal(res.status, 400);
    const paths = res.body.errors.map((e) => e.path).sort();
    assert.deepEqual(paths, ['email', 'password', 'username']);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => createUser(app));

  test('returns a token for correct credentials, any email case', async () => {
    const res = await login({ email: 'LANE@example.com', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, 'lane');
  });

  test('wrong password and unknown email get the same 401', async () => {
    const wrongPassword = await login({
      email: 'lane@example.com',
      password: 'wrong-password-123',
    });
    const unknownEmail = await login({ email: 'nobody@example.com', password: PASSWORD });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  test('empty password is a 400, not a 401', async () => {
    const res = await login({ email: 'lane@example.com', password: '' });
    assert.equal(res.status, 400);
  });
});

describe('GET /api/auth/me', () => {
  test('returns the user for a valid token', async () => {
    const { token, user } = await createUser(app);
    const res = await me(bearer(token));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user, user);
  });

  test('401 without a token', async () => {
    assert.equal((await me()).status, 401);
  });

  test('401 for a garbage token', async () => {
    assert.equal((await me(bearer('not.a.jwt'))).status, 401);
  });

  test('401 for a token signed with another secret', async () => {
    const token = jwt.sign({ userId: 1 }, 'some-other-secret');
    assert.equal((await me(bearer(token))).status, 401);
  });

  test('401 for an expired token', async () => {
    const { user } = await createUser(app);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    assert.equal((await me(bearer(token))).status, 401);
  });

  test('401 for an old Mongo-era token with an ObjectId', async () => {
    const token = jwt.sign({ userId: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
    assert.equal((await me(bearer(token))).status, 401);
  });

  test('401, not 404, once the user is deleted', async () => {
    const { token, user } = await createUser(app);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    const res = await me(bearer(token));
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Account no longer exists');
  });
});