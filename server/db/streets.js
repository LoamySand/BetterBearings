const { pool } = require('./pool');
const rules = require('../streetRules');

// Picks up to `count` random streets near a point from osm.streets and merges each street's
// segments into one MultiLineString.
//
// area:    every game-type segment within the radius, flagged if it passes this difficulty's rules,
//          with the meters its name has in its road class (a window sum)
// grouped: one row per name (case-insensitive), all its segments merged, in one GROUP BY pass.
//          The type is the dominant class, the one with the most meters (KAN-73): it decides the
//          level, so a mostly-secondary road with a tertiary end is Easy, and a residential street
//          with a short secondary piece stays out of Easy games.
//          A window, not a join: the planner estimates `area` at 1 row (geography ST_DWithin), and
//          a join on it ran as a nested loop, 8x slower at 7,900 segments.
// leveled: names with at least one qualifying segment and a dominant class this difficulty
//          allows, named after their first qualifying segment, numbered 1, 2, 3... in random
//          order within their level (1 Easy, 2 Medium, 3 Hard; KAN-75)
// final:   dealt in rounds: one street of each level per round, until `count`. When a level
//          runs out the others keep going, so a short level rolls its slots over to the rest.
//          Northeast Hard at 200 (16 / 52 / 1,519 in the area) gives 16 / 52 / 132, and an area
//          with plenty of every level 67 / 67 / 66. planGame shuffles, so the order is not seen.
const PICK_SQL = `
  WITH center AS (
    SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS pt
  ),
  area AS (
    SELECT s.osm_id, s.name, lower(s.name) AS key, s.highway, s.ref, s.old_name, s.loc_name,
           substring(s.width FROM '^([0-9]+(\\.[0-9]+)?)( ?m)?$')::float8 AS width_m,
           coalesce(s.tags->>'area' = 'yes', false) OR ST_IsClosed(s.geom) AS enclosed,
           s.geom,
           ST_Length(s.geom::geography) AS meters,
           -- Meters of this name in this road class, for the dominant class below
           sum(ST_Length(s.geom::geography)) OVER (PARTITION BY lower(s.name), s.highway) AS class_meters,
           (s.highway = ANY($5::text[])
             AND ($6::text IS NULL OR s.ref ~* $6)
             AND ($7::boolean OR coalesce(s.tags->>'access', '') <> 'private')
             AND NOT (lower(s.name) = ANY($8::text[]) OR lower(s.name) ~ $9)
             AND ST_Length(s.geom::geography) >= $10) AS qualifies
    FROM osm.streets s, center c
    -- && on the bounding box uses the GIST index; ST_DWithin on geography then checks metres
    WHERE s.geom && ST_Envelope(ST_Buffer(c.pt::geography, $3)::geometry)
      AND ST_DWithin(s.geom::geography, c.pt::geography, $3)
      AND s.highway = ANY($4::text[])
  ),
  grouped AS (
    SELECT min(osm_id) FILTER (WHERE qualifies) AS osm_id,
           (array_agg(name ORDER BY osm_id) FILTER (WHERE qualifies))[1] AS name,
           -- Dominant class; ties go to the easier class ($4 lists Easy, then Medium, then Hard)
           (array_agg(highway ORDER BY class_meters DESC, array_position($4::text[], highway)))[1]
             AS highway,
           (array_agg(ref ORDER BY osm_id) FILTER (WHERE qualifies))[1] AS ref,
           (array_agg(old_name ORDER BY osm_id) FILTER (WHERE qualifies))[1] AS old_name,
           (array_agg(loc_name ORDER BY osm_id) FILTER (WHERE qualifies))[1] AS loc_name,
           sum(meters) AS meters,
           avg(width_m) AS width,
           bool_or(enclosed) AS enclosed,
           ST_Multi(ST_Collect(geom ORDER BY osm_id)) AS geom
    FROM area
    GROUP BY key
    HAVING bool_or(qualifies)
       AND (array_agg(highway ORDER BY class_meters DESC, array_position($4::text[], highway)))[1]
           = ANY($5::text[])
  ),
  leveled AS (
    SELECT g.*, l.level, row_number() OVER (PARTITION BY l.level ORDER BY random()) AS rn
    FROM grouped g
    CROSS JOIN LATERAL (
      SELECT CASE WHEN g.highway = ANY($12::text[]) THEN 1
                  WHEN g.highway = ANY($13::text[]) THEN 2
                  ELSE 3 END AS level
    ) l
  )
  SELECT osm_id, name, highway, ref, old_name, loc_name, meters, width, enclosed,
         ST_AsGeoJSON(geom)::json AS geom
  FROM leveled
  ORDER BY rn, level
  LIMIT $11`;

const majorRef = new RegExp(rules.MAJOR_REF_PATTERN, 'i');

// Same order as getNamesFromElement in the client
function alternativeName(r) {
  if (r.old_name && r.old_name !== r.name) return r.old_name;
  if (r.loc_name && r.loc_name !== r.name) return r.loc_name;
  if (r.ref && r.ref !== r.name && majorRef.test(r.ref)) return r.ref;
  return null;
}

// PostGIS [lng, lat] to the client's [lat, lng], as in streetSets.js
const swap = (lines) => lines.map((line) => line.map(([a, b]) => [b, a]));

async function pickStreets({ lat, lng, radius, difficulty, count }) {
  const r = rules.rulesFor(difficulty);
  const { rows } = await pool.query(PICK_SQL, [
    lng,
    lat,
    radius,
    rules.GAME_TYPES,
    r.types,
    r.refPattern,
    r.allowPrivate,
    rules.EXCLUDED_NAMES,
    rules.EXCLUDED_NAME_PATTERN,
    rules.MIN_SEGMENT_METERS,
    count,
    rules.TOURIST,
    rules.RESIDENT,
  ]);
  return rows.map((row) => ({
    osmId: Number(row.osm_id),
    name: row.name,
    alternativeName: alternativeName(row),
    type: row.highway,
    length: row.meters,
    width: row.width,
    isEnclosedArea: row.enclosed,
    coordinates: swap(row.geom.coordinates),
  }));
}

module.exports = { pickStreets, PICK_SQL };
