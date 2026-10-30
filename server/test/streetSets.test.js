const { describe, test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../app');
const { pool, resetDb, createUser, bearer } = require('./helpers');

const app = createApp();

after(() => pool.end());

// Albuquerque. Lat and lng are far apart in value, so a swap anywhere is obvious.
const centralAve = {
  osmId: 123456,
  name: 'Central Avenue',
  type: 'primary',
  length: 412.5,
  included: true,
  difficulty: 1,
  coordinates: [
    [
      [35.0844, -106.6504],
      [35.0846, -106.6489],
    ],
    [
      [35.0846, -106.6489],
      [35.0849, -106.6471],
    ],
  ],
};

const goldAve = {
  osmId: 654321,
  name: 'Gold Avenue',
  included: false,
  coordinates: [
    [
      [35.0831, -106.6508],
      [35.0833, -106.6475],
    ],
  ],
};

const validSet = (overrides = {}) => ({
  name: 'Downtown',
  description: 'Practice set',
  center: { lat: 35.0844, lng: -106.6504 },
  radius: 1500,
  streets: [centralAve, goldAve],
  ...overrides,
});

let alice;
let bob;

beforeEach(async () => {
  await resetDb();
  alice = await createUser(app, { username: 'alice', email: 'alice@example.com' });
  bob = await createUser(app, { username: 'bob', email: 'bob@example.com' });
});

const createSet = (user, body = validSet()) =>
  request(app).post('/api/street-sets').set(bearer(user.token)).send(body);

describe('create and read', () => {
  test('POST returns 201 with the full set and street counts', async () => {
    const res = await createSet(alice);
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Downtown');
    assert.equal(res.body.radius, 1500);
    assert.deepEqual(res.body.center, { lat: 35.0844, lng: -106.6504 });
    assert.equal(res.body.totalStreets, 2);
    assert.equal(res.body.includedStreets, 1);
  });

  test('coordinates come back in the [lat, lng] order they were sent', async () => {
    const { body: created } = await createSet(alice);
    const res = await request(app).get(`/api/street-sets/${created.id}`).set(bearer(alice.token));

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.streets.map((s) => s.name),
      ['Central Avenue', 'Gold Avenue']
    );
    assert.deepEqual(res.body.streets[0].coordinates, centralAve.coordinates);
    assert.deepEqual(res.body.streets[1].coordinates, goldAve.coordinates);
  });

  test('PostGIS stores [lng, lat], so x is the longitude', async () => {
    // The round-trip above also passes if both swaps are missing. This pins the stored order.
    await createSet(alice);
    const { rows } = await pool.query(
      `SELECT ST_X(ST_StartPoint(ST_GeometryN(geom, 1))) AS x,
              ST_Y(ST_StartPoint(ST_GeometryN(geom, 1))) AS y
       FROM street_set_streets WHERE name = 'Central Avenue'`
    );
    assert.deepEqual(rows[0], { x: -106.6504, y: 35.0844 });
  });

  test('list returns summaries without streets', async () => {
    await createSet(alice);
    const res = await request(app).get('/api/street-sets').set(bearer(alice.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].totalStreets, 2);
    assert.equal(res.body[0].includedStreets, 1);
    assert.equal(res.body[0].streets, undefined);
  });
});

describe('update and delete', () => {
  test('PUT with only a name keeps the streets', async () => {
    const { body: created } = await createSet(alice);
    const res = await request(app)
      .put(`/api/street-sets/${created.id}`)
      .set(bearer(alice.token))
      .send({ name: 'Renamed' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Renamed');
    assert.equal(res.body.totalStreets, 2);
  });

  test('PUT with streets replaces them', async () => {
    const { body: created } = await createSet(alice);
    const res = await request(app)
      .put(`/api/street-sets/${created.id}`)
      .set(bearer(alice.token))
      .send({ streets: [goldAve] });
    assert.equal(res.status, 200);
    assert.equal(res.body.totalStreets, 1);
    assert.deepEqual(
      res.body.streets.map((s) => s.name),
      ['Gold Avenue']
    );
  });

  test('DELETE removes the set and its streets', async () => {
    const { body: created } = await createSet(alice);
    const res = await request(app)
      .delete(`/api/street-sets/${created.id}`)
      .set(bearer(alice.token));
    assert.equal(res.status, 200);

    const again = await request(app).get(`/api/street-sets/${created.id}`).set(bearer(alice.token));
    assert.equal(again.status, 404);

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM street_set_streets');
    assert.equal(rows[0].n, 0);
  });
});

describe('ownership', () => {
  test('another user gets 404 on GET, PUT and DELETE, and the set is untouched', async () => {
    const { body: created } = await createSet(alice);
    const url = `/api/street-sets/${created.id}`;

    const get = await request(app).get(url).set(bearer(bob.token));
    const put = await request(app).put(url).set(bearer(bob.token)).send({ name: 'Mine now' });
    const del = await request(app).delete(url).set(bearer(bob.token));

    assert.deepEqual([get.status, put.status, del.status], [404, 404, 404]);

    const stillThere = await request(app).get(url).set(bearer(alice.token));
    assert.equal(stillThere.status, 200);
    assert.equal(stillThere.body.name, 'Downtown');
    assert.equal(stillThere.body.totalStreets, 2);
  });

  test("another user's list does not include the set", async () => {
    await createSet(alice);
    const res = await request(app).get('/api/street-sets').set(bearer(bob.token));
    assert.deepEqual(res.body, []);
  });

  test('a non-numeric id is a 404, not a 500', async () => {
    const res = await request(app)
      .get('/api/street-sets/507f1f77bcf86cd799439011')
      .set(bearer(alice.token));
    assert.equal(res.status, 404);
  });

  test('401 without a token', async () => {
    const res = await request(app).get('/api/street-sets');
    assert.equal(res.status, 401);
  });

  test('POST with a deleted user token is 401, not 500', async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [alice.user.id]);
    const res = await createSet(alice);
    assert.equal(res.status, 401);
  });
});

describe('validation and body limits', () => {
  test('[lng, lat] instead of [lat, lng] is a 400 that names the point', async () => {
    const swapped = {
      ...goldAve,
      coordinates: [
        [
          [-106.6508, 35.0831],
          [-106.6475, 35.0833],
        ],
      ],
    };
    const res = await createSet(alice, validSet({ streets: [swapped] }));
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].path, 'streets.0.coordinates.0.0.0');
  });

  test('more than 200 streets is a 400', async () => {
    const res = await createSet(alice, validSet({ streets: Array(201).fill(goldAve) }));
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'A street set can have at most 200 streets');
  });

  test('a body over 1.5 MB is a 413', async () => {
    const res = await createSet(alice, validSet({ description: 'x'.repeat(1_600_000) }));
    assert.equal(res.status, 413);
  });

  test('the 1.5 MB limit applies only to street sets; signup stays at 10 kB', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'carol', email: 'carol@example.com', password: 'x'.repeat(11_000) });
    assert.equal(res.status, 413);
  });

  test('malformed JSON is a 400', async () => {
    const res = await request(app)
      .post('/api/street-sets')
      .set(bearer(alice.token))
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Malformed JSON');
  });
});