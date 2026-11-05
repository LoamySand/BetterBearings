const { pool, withTransaction } = require('./pool');

// Client sends [lat, lng]; PostGIS stores [lng, lat]. Same swap both directions.
const swap = (lines) => lines.map((line) => line.map(([a, b]) => [b, a]));

const SUMMARY_SQL = `
  SELECT s.id, s.name, s.description,
         ST_Y(s.center::geometry) AS lat,
         ST_X(s.center::geometry) AS lng,
         s.radius, s.created_at, s.updated_at,
         count(st.id)::int                            AS total_streets,
         count(st.id) FILTER (WHERE st.included)::int AS included_streets
  FROM street_sets s
  LEFT JOIN street_set_streets st ON st.street_set_id = s.id
  WHERE s.user_id = $1
    AND ($2::bigint IS NULL OR s.id = $2)
  GROUP BY s.id
  ORDER BY s.updated_at DESC`;

const STREETS_SQL = `
  SELECT osm_id, name, alternative_name, type, length, width,
         is_enclosed_area, included, difficulty,
         ST_AsGeoJSON(geom)::json AS geom
  FROM street_set_streets
  WHERE street_set_id = $1
  ORDER BY position`;

const INSERT_STREETS_SQL = `
  INSERT INTO street_set_streets
    (street_set_id, position, osm_id, name, alternative_name, type,
     length, width, is_enclosed_area, included, difficulty, geom)
  SELECT $1, s.position, s.osm_id, s.name, s.alternative_name, s.type,
         s.length, s.width, s.is_enclosed_area, s.included, s.difficulty,
         ST_SetSRID(ST_GeomFromGeoJSON(s.geom), 4326)
  FROM jsonb_to_recordset($2::jsonb) AS s(
    position int, osm_id bigint, name text, alternative_name text, type text,
    length float8, width float8, is_enclosed_area boolean, included boolean,
    difficulty smallint, geom jsonb)`;

function toDbStreets(streets) {
  return streets.map((s, i) => ({
    position: i,
    osm_id: s.osmId ?? null,
    name: s.name,
    alternative_name: s.alternativeName ?? null,
    type: s.type ?? null,
    length: s.length ?? null,
    width: s.width ?? null,
    is_enclosed_area: Boolean(s.isEnclosedArea),
    included: s.included !== false,
    difficulty: s.difficulty ?? 2,
    geom: { type: 'MultiLineString', coordinates: swap(s.coordinates) },
  }));
}

function toApiStreet(r) {
  return {
    osmId: r.osm_id === null ? null : Number(r.osm_id),
    name: r.name,
    alternativeName: r.alternative_name,
    type: r.type,
    length: r.length,
    width: r.width,
    isEnclosedArea: r.is_enclosed_area,
    included: r.included,
    difficulty: r.difficulty,
    coordinates: swap(r.geom.coordinates),
  };
}

function toApiStreetSet(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    center: { lat: r.lat, lng: r.lng },
    radius: r.radius,
    totalStreets: r.total_streets,
    includedStreets: r.included_streets,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function listStreetSets(userId) {
  const { rows } = await pool.query(SUMMARY_SQL, [userId, null]);
  return rows.map(toApiStreetSet);
}

async function getStreetSet(userId, id, db = pool) {
  const { rows } = await db.query(SUMMARY_SQL, [userId, id]);
  if (rows.length === 0) return null;
  const streets = await db.query(STREETS_SQL, [id]);
  return { ...toApiStreetSet(rows[0]), streets: streets.rows.map(toApiStreet) };
}

async function insertStreets(client, setId, streets) {
  await client.query(INSERT_STREETS_SQL, [setId, JSON.stringify(toDbStreets(streets))]);
}

async function createStreetSet(userId, { name, description, center, radius, streets }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO street_sets (user_id, name, description, center, radius)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6)
       RETURNING id`,
      [userId, name.trim(), description ?? '', center.lng, center.lat, Math.round(radius)]
    );
    await insertStreets(client, rows[0].id, streets);
    return getStreetSet(userId, rows[0].id, client);
  });
}

async function updateStreetSet(userId, id, { name, description, streets }) {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE street_sets
       SET name = COALESCE($3, name),
           description = COALESCE($4, description),
           updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [id, userId, name ? name.trim() : null, description ?? null]
    );
    if (rowCount === 0) return null;

    if (Array.isArray(streets)) {
      await client.query('DELETE FROM street_set_streets WHERE street_set_id = $1', [id]);
      await insertStreets(client, id, streets);
    }
    return getStreetSet(userId, id, client);
  });
}

async function deleteStreetSet(userId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM street_sets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { listStreetSets, getStreetSet, createStreetSet, updateStreetSet, deleteStreetSet };