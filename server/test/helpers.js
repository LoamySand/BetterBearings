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

// osm.streets comes from osm-import in real environments (deploy/osm/streets.lua), never from
// migrations. Tests create the same columns and insert fixture rows; keep the two in sync.
async function resetOsmStreets() {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS osm;
    CREATE TABLE IF NOT EXISTS osm.streets (
      osm_id   bigint NOT NULL,
      name     text NOT NULL,
      highway  text NOT NULL,
      ref      text,
      old_name text,
      loc_name text,
      width    text,
      tags     jsonb,
      geom     geometry(LineString, 4326) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS streets_geom_gist ON osm.streets USING gist (geom);
    TRUNCATE osm.streets;`);
}

// coordinates in client order, [[lat, lng], ...]
async function insertOsmStreet({ coordinates, tags = null, ...cols }) {
  const lineString = {
    type: 'LineString',
    coordinates: coordinates.map(([lat, lng]) => [lng, lat]),
  };
  await pool.query(
    `INSERT INTO osm.streets (osm_id, name, highway, ref, old_name, loc_name, width, tags, geom)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromGeoJSON($9), 4326))`,
    [
      cols.osmId,
      cols.name,
      cols.highway,
      cols.ref ?? null,
      cols.oldName ?? null,
      cols.locName ?? null,
      cols.width ?? null,
      tags,
      JSON.stringify(lineString),
    ]
  );
}

module.exports = {
  pool,
  resetDb,
  createUser,
  bearer,
  PASSWORD,
  resetOsmStreets,
  insertOsmStreet,
};
