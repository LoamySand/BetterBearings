const { describe, test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../app');
const { pool, resetDb, createUser, bearer, PASSWORD } = require('./helpers');

const app = createApp();

after(() => pool.end());

const oneStreet = {
  name: 'Central Avenue',
  coordinates: [
    [
      [35.0844, -106.6504],
      [35.0846, -106.6489],
    ],
  ],
};

const createSet = (user, name) =>
  request(app)
    .post('/api/street-sets')
    .set(bearer(user.token))
    .send({
      name,
      center: { lat: 35.0844, lng: -106.6504 },
      radius: 1000,
      streets: [oneStreet, { ...oneStreet, name: 'Gold Avenue' }],
    })
    .expect(201);

const deleteAccount = (user, body) =>
  request(app).delete('/api/auth/me').set(bearer(user.token)).send(body);

const me = (user) => request(app).get('/api/auth/me').set(bearer(user.token));

async function counts() {
  const { rows } = await pool.query(`
    SELECT (SELECT count(*)::int FROM users)              AS users,
           (SELECT count(*)::int FROM street_sets)        AS sets,
           (SELECT count(*)::int FROM street_set_streets) AS streets`);
  return rows[0];
}

let alice;
let bob;

beforeEach(async () => {
  await resetDb();
  alice = await createUser(app, { username: 'alice', email: 'alice@example.com' });
  bob = await createUser(app, { username: 'bob', email: 'bob@example.com' });
});

describe('DELETE /api/auth/me', () => {
  test('401 without a token', async () => {
    const res = await request(app).delete('/api/auth/me').send({ password: PASSWORD });
    assert.equal(res.status, 401);
  });

  test('400 without a password', async () => {
    const res = await deleteAccount(alice, {});
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].path, 'password');
  });

  test('403 for a wrong password, and the session survives', async () => {
    // 403, not 401: the client drops its token on 401, which would log the user out
    const res = await deleteAccount(alice, { password: 'wrong-password-123' });
    assert.equal(res.status, 403);
    assert.equal((await me(alice)).status, 200);
    assert.equal((await counts()).users, 2);
  });

  test('204 for the right password; the token and login stop working', async () => {
    const res = await deleteAccount(alice, { password: PASSWORD });
    assert.equal(res.status, 204);
    assert.equal(res.text, '');

    assert.equal((await me(alice)).status, 401);
    assert.equal((await deleteAccount(alice, { password: PASSWORD })).status, 401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD });
    assert.equal(login.status, 401);
  });

  test("cascade removes only that user's sets and streets", async () => {
    await createSet(alice, 'Downtown');
    await createSet(alice, 'Nob Hill');
    await createSet(bob, 'Old Town');
    assert.deepEqual(await counts(), { users: 2, sets: 3, streets: 6 });

    await deleteAccount(alice, { password: PASSWORD }).expect(204);

    assert.deepEqual(await counts(), { users: 1, sets: 1, streets: 2 });
    const bobsSets = await request(app).get('/api/street-sets').set(bearer(bob.token));
    assert.deepEqual(
      bobsSets.body.map((s) => [s.name, s.totalStreets]),
      [['Old Town', 2]]
    );
  });

  test('the email and username can be registered again', async () => {
    await deleteAccount(alice, { password: PASSWORD }).expect(204);
    const again = await createUser(app, { username: 'alice', email: 'alice@example.com' });
    assert.ok(again.token);
  });
});