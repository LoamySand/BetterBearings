const { describe, test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../app');
const { pool, resetOsmStreets, insertOsmStreet } = require('./helpers');

const app = createApp();
after(() => pool.end());

// Downtown Albuquerque. 0.002 degrees of latitude is about 222 m, over the 150 m minimum.
const LAT = 35.0844;
const LNG = -106.6504;
const ns = (lng, lat0 = LAT, lat1 = LAT + 0.002) => [
  [lat0, lng],
  [lat1, lng],
];

const get = (query) => request(app).get('/api/streets').query(query);
const near = (extra = {}) => get({ lat: LAT, lng: LNG, radius: 1000, count: 50, ...extra });
const names = (res) => res.body.streets.map((s) => s.name).sort();

beforeEach(resetOsmStreets);

describe('GET /api/streets', () => {
  test('returns coordinates in [lat, lng] order', async () => {
    await insertOsmStreet({
      osmId: 1,
      name: 'Central Avenue',
      highway: 'primary',
      coordinates: ns(LNG),
    });
    const res = await near();
    assert.equal(res.status, 200);
    assert.equal(res.body.streets.length, 1);
    const [first] = res.body.streets[0].coordinates[0];
    assert.deepEqual(first, [LAT, LNG]);
  });

  test('merges same-name segments, case-insensitively, into one street', async () => {
    await insertOsmStreet({
      osmId: 20,
      name: 'Central Avenue',
      highway: 'primary',
      coordinates: ns(LNG),
    });
    await insertOsmStreet({
      osmId: 10,
      name: 'Central Avenue',
      highway: 'primary',
      coordinates: ns(LNG + 0.001),
    });
    // Too short to be a question on its own, but still drawn as part of the street
    await insertOsmStreet({
      osmId: 30,
      name: 'central avenue',
      highway: 'primary',
      coordinates: ns(LNG + 0.002, LAT, LAT + 0.0005),
    });
    const res = await near();
    assert.equal(res.body.streets.length, 1);
    const street = res.body.streets[0];
    assert.equal(street.osmId, 10);
    assert.equal(street.coordinates.length, 3);
    assert.ok(street.length > 444 && street.length < 520, `length ${street.length}`);
  });

  test('response fields match what the game uses', async () => {
    await insertOsmStreet({
      osmId: 5,
      name: 'Pan American Freeway',
      highway: 'motorway',
      ref: 'I-25',
      width: '12 m',
      coordinates: ns(LNG),
    });
    const [street] = (await near()).body.streets;
    assert.deepEqual(Object.keys(street).sort(), [
      'alternativeName',
      'coordinates',
      'isEnclosedArea',
      'length',
      'name',
      'osmId',
      'type',
      'width',
    ]);
    assert.equal(street.type, 'motorway');
    assert.equal(street.alternativeName, 'I-25');
    assert.equal(street.width, 12);
    assert.equal(street.isEnclosedArea, false);
  });

  test('old_name wins over ref for the alternative name', async () => {
    await insertOsmStreet({
      osmId: 1,
      name: 'Central Avenue',
      highway: 'primary',
      ref: 'US 66',
      oldName: 'Route 66',
      coordinates: ns(LNG),
    });
    assert.equal((await near()).body.streets[0].alternativeName, 'Route 66');
  });

  test('difficulty decides the street types', async () => {
    await insertOsmStreet({
      osmId: 1,
      name: 'Lomas Boulevard',
      highway: 'primary',
      coordinates: ns(LNG),
    });
    await insertOsmStreet({
      osmId: 2,
      name: 'Silver Avenue',
      highway: 'tertiary',
      coordinates: ns(LNG + 0.001),
    });
    await insertOsmStreet({
      osmId: 3,
      name: 'Edith Boulevard',
      highway: 'residential',
      coordinates: ns(LNG + 0.002),
    });
    assert.deepEqual(names(await near({ difficulty: 'tourist' })), ['Lomas Boulevard']);
    assert.deepEqual(names(await near({ difficulty: 'resident' })), [
      'Lomas Boulevard',
      'Silver Avenue',
    ]);
    assert.equal((await near({ difficulty: 'taxi-driver' })).body.streets.length, 3);
  });

  test('a street takes its dominant class, by meters (KAN-73)', async () => {
    // Osuna: the oldest segment (lowest osm_id) is a short tertiary end; most of it is secondary
    await insertOsmStreet({
      osmId: 1,
      name: 'Osuna Road',
      highway: 'tertiary',
      coordinates: ns(LNG),
    });
    await insertOsmStreet({
      osmId: 2,
      name: 'Osuna Road',
      highway: 'secondary',
      coordinates: ns(LNG, LAT + 0.002, LAT + 0.004),
    });
    await insertOsmStreet({
      osmId: 3,
      name: 'Osuna Road',
      highway: 'secondary',
      coordinates: ns(LNG, LAT + 0.004, LAT + 0.006),
    });
    // Mostly residential, with one secondary block long enough to qualify on its own
    await insertOsmStreet({
      osmId: 4,
      name: 'Edith Boulevard',
      highway: 'secondary',
      coordinates: ns(LNG + 0.002),
    });
    for (const [i, lat0] of [LAT + 0.002, LAT + 0.004].entries()) {
      await insertOsmStreet({
        osmId: 5 + i,
        name: 'Edith Boulevard',
        highway: 'residential',
        coordinates: ns(LNG + 0.002, lat0, lat0 + 0.002),
      });
    }

    const types = async (difficulty) =>
      Object.fromEntries((await near({ difficulty })).body.streets.map((s) => [s.name, s.type]));
    assert.deepEqual(await types('tourist'), { 'Osuna Road': 'secondary' });
    assert.deepEqual(await types('resident'), { 'Osuna Road': 'secondary' });
    assert.deepEqual(await types('taxi-driver'), {
      'Osuna Road': 'secondary',
      'Edith Boulevard': 'residential',
    });
  });

  test('major state roads match on ref, not type', async () => {
    await insertOsmStreet({
      osmId: 1,
      name: 'Pan American Freeway',
      highway: 'motorway',
      ref: 'I-25',
      coordinates: ns(LNG),
    });
    await insertOsmStreet({
      osmId: 2,
      name: 'Lomas Boulevard',
      highway: 'primary',
      coordinates: ns(LNG + 0.001),
    });
    assert.deepEqual(names(await near({ difficulty: 'major-state-roads' })), [
      'Pan American Freeway',
    ]);
  });

  test('skips footways and paths, excluded names, short streets and private roads', async () => {
    await insertOsmStreet({
      osmId: 1,
      name: 'Bosque Trail',
      highway: 'path',
      coordinates: ns(LNG),
    });
    await insertOsmStreet({
      osmId: 2,
      name: 'Alley',
      highway: 'service',
      coordinates: ns(LNG + 0.001),
    });
    await insertOsmStreet({
      osmId: 3,
      name: 'Service Road A',
      highway: 'service',
      coordinates: ns(LNG + 0.002),
    });
    await insertOsmStreet({
      osmId: 4,
      name: 'Short Street',
      highway: 'residential',
      coordinates: ns(LNG + 0.003, LAT, LAT + 0.0005),
    });
    await insertOsmStreet({
      osmId: 5,
      name: 'Gated Way',
      highway: 'primary',
      tags: { access: 'private' },
      coordinates: ns(LNG + 0.004),
    });
    assert.deepEqual(names(await near({ difficulty: 'tourist' })), []);
    // Taxi drivers go everywhere, including private roads
    assert.deepEqual(names(await near({ difficulty: 'taxi-driver' })), ['Gated Way']);
  });

  test('closed ways and area=yes are enclosed areas', async () => {
    await insertOsmStreet({
      osmId: 1,
      name: 'Civic Plaza',
      highway: 'primary',
      coordinates: [
        [LAT, LNG],
        [LAT + 0.002, LNG],
        [LAT + 0.002, LNG + 0.002],
        [LAT, LNG],
      ],
    });
    await insertOsmStreet({
      osmId: 2,
      name: 'Pedestrian Mall',
      highway: 'primary',
      tags: { area: 'yes' },
      coordinates: ns(LNG + 0.003),
    });
    const enclosed = Object.fromEntries(
      (await near()).body.streets.map((s) => [s.name, s.isEnclosedArea])
    );
    assert.deepEqual(enclosed, { 'Civic Plaza': true, 'Pedestrian Mall': true });
  });

  test('only streets within the radius', async () => {
    await insertOsmStreet({
      osmId: 1,
      name: 'Central Avenue',
      highway: 'primary',
      coordinates: ns(LNG),
    });
    // About 4.5 km east
    await insertOsmStreet({
      osmId: 2,
      name: 'Tramway Boulevard',
      highway: 'primary',
      coordinates: ns(LNG + 0.05),
    });
    assert.deepEqual(names(await near({ radius: 1000 })), ['Central Avenue']);
    assert.equal((await near({ radius: 5000 })).body.streets.length, 2);
  });

  test('count caps the result and picks distinct streets', async () => {
    for (let i = 1; i <= 5; i++) {
      await insertOsmStreet({
        osmId: i,
        name: `Street ${i}`,
        highway: 'primary',
        coordinates: ns(LNG + i * 0.001),
      });
    }
    const res = await near({ count: 3 });
    assert.equal(res.body.streets.length, 3);
    assert.equal(new Set(names(res)).size, 3);
  });

  describe('balanced pick across levels (KAN-75)', () => {
    // n streets of one road class, 22 m apart, all inside the 1 km radius
    let nextId = 1;
    const addStreets = async (highway, n) => {
      for (let i = 0; i < n; i++) {
        const id = nextId++;
        await insertOsmStreet({
          osmId: id,
          name: `${highway} ${i}`,
          highway,
          coordinates: ns(LNG + id * 0.0002),
        });
      }
    };
    const LEVEL = { secondary: 'easy', tertiary: 'medium', residential: 'hard' };
    const split = async (query) => {
      const counts = { easy: 0, medium: 0, hard: 0 };
      const res = await near({ difficulty: 'taxi-driver', ...query });
      for (const s of res.body.streets) counts[LEVEL[s.type]]++;
      return counts;
    };
    beforeEach(() => {
      nextId = 1;
    });

    test('a third of count per level when every level has enough', async () => {
      await addStreets('secondary', 10);
      await addStreets('tertiary', 10);
      await addStreets('residential', 10);
      assert.deepEqual(await split({ count: 9 }), { easy: 3, medium: 3, hard: 3 });
      // Uneven count: the extra goes to the easier level
      assert.deepEqual(await split({ count: 10 }), { easy: 4, medium: 3, hard: 3 });
    });

    test('a short level rolls its slots over to the others', async () => {
      await addStreets('secondary', 1);
      await addStreets('tertiary', 10);
      await addStreets('residential', 10);
      assert.deepEqual(await split({ count: 9 }), { easy: 1, medium: 4, hard: 4 });
      // Medium level allows no Hard: Easy runs out, Medium takes the rest
      assert.deepEqual(await split({ count: 9, difficulty: 'resident' }), {
        easy: 1,
        medium: 8,
        hard: 0,
      });
    });

    test('an area with fewer streets than count gives every street', async () => {
      await addStreets('secondary', 2);
      await addStreets('tertiary', 1);
      await addStreets('residential', 3);
      assert.deepEqual(await split({ count: 50 }), { easy: 2, medium: 1, hard: 3 });
    });
  });

  test('an area with no streets gives an empty list', async () => {
    const res = await near();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { streets: [] });
  });

  test('radius over 5000 is a 400', async () => {
    const res = await near({ radius: 5001 });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].path, 'radius');
  });

  test('missing or out-of-range values are 400s', async () => {
    assert.equal((await get({ lng: LNG, radius: 1000 })).status, 400);
    assert.equal((await near({ lat: 95 })).status, 400);
    assert.equal((await near({ difficulty: 'expert' })).status, 400);
    assert.equal((await near({ count: 201 })).status, 400);
  });

  test('503 when osm.streets has not been imported', async () => {
    await pool.query('ALTER TABLE osm.streets RENAME TO streets_missing');
    try {
      const res = await near();
      assert.equal(res.status, 503);
    } finally {
      await pool.query('ALTER TABLE osm.streets_missing RENAME TO streets');
    }
  });
});
