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
