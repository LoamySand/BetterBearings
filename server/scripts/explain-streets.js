// EXPLAIN ANALYZE the /api/streets query (KAN-57), plus timing and response size.
// Laptop:  node --env-file=.env scripts/explain-streets.js [lat] [lng] [radius] [difficulty] [count]
// Staging: docker compose exec app node scripts/explain-streets.js
const { PICK_SQL, pickStreets } = require('../db/streets');
const rules = require('../streetRules');
const { pool } = require('../db/pool');

const [lat = 35.0844, lng = -106.6504, radius = 5000] = process.argv.slice(2, 5).map(Number);
const difficulty = process.argv[5] || 'taxi-driver';
const count = Number(process.argv[6] || 200);

(async () => {
  const r = rules.rulesFor(difficulty);
  const params = [
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
  ];
  const plan = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${PICK_SQL}`, params);
  console.log(plan.rows.map((row) => row['QUERY PLAN']).join('\n'));

  const start = process.hrtime.bigint();
  const streets = await pickStreets({ lat, lng, radius, difficulty, count });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  const bytes = Buffer.byteLength(JSON.stringify({ streets }));
  console.log(
    `\n${difficulty}, radius ${radius} m, count ${count}: ${streets.length} streets, ` +
      `${ms.toFixed(0)} ms, ${(bytes / 1024).toFixed(0)} KB JSON`
  );
  await pool.end();
})();
