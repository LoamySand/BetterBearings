#!/usr/bin/env bash
# Load named streets from a Geofabrik extract into osm.streets (KAN-56).
# Runs inside the osm-import container: docker compose run --rm osm-import
# Builds osm.streets_import, indexes it, then swaps it in, so osm.streets is never empty mid-import.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
PBF_URL="${OSM_PBF_URL:-https://download.geofabrik.de/north-america/us/new-mexico-latest.osm.pbf}"
DATA_DIR="${OSM_DATA_DIR:-/data}"

extract="$DATA_DIR/$(basename "$PBF_URL")"
filtered="$DATA_DIR/streets-filtered.osm.pbf"
start=$(date +%s)
stage() { echo "[$(( $(date +%s) - start ))s] $*"; }
psql_q() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }
# Peak memory of this container so far (cgroup v2); sets compose mem_limit from a measurement
peak_mem() {
  local f=/sys/fs/cgroup/memory.peak
  if [ -r "$f" ]; then stage "peak memory so far $(( $(cat "$f") / 1048576 )) MiB"; fi
}
mkdir -p "$DATA_DIR"
stage "download $PBF_URL"
# -z: only download when Geofabrik has a newer file than the one already in the volume
if [ -f "$extract" ]; then
  curl -fsSL -z "$extract" -o "$extract.part" "$PBF_URL"
else
  curl -fsSL -o "$extract.part" "$PBF_URL"
fi
if [ -s "$extract.part" ]; then mv "$extract.part" "$extract"; else rm -f "$extract.part"; fi
data_ts="$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$extract" || true)"
stage "extract $(du -h "$extract" | cut -f1), data as of ${data_ts:-unknown}"

stage "filter highway ways"
# Drops buildings, land use, POIs and so on; streets.lua then keeps the named ones
osmium tags-filter --overwrite -o "$filtered" "$extract" w/highway
peak_mem

psql_q <<'SQL'
CREATE SCHEMA IF NOT EXISTS osm;
DROP TABLE IF EXISTS osm.streets_import;
CREATE TABLE IF NOT EXISTS osm.import_log (
  id            bigserial PRIMARY KEY,
  finished_at   timestamptz NOT NULL DEFAULT now(),
  source_url    text NOT NULL,
  data_timestamp timestamptz,
  row_count     bigint NOT NULL,
  total_bytes   bigint NOT NULL,
  seconds       integer NOT NULL
);
SQL

stage "osm2pgsql"
# --slim --drop: node locations go to temporary tables in the osm schema instead of RAM, then are dropped.
# No --flat-nodes: that file is sized by the planet's highest node ID, not by the extract.
osm2pgsql --create --slim --drop --output=flex --style /osm/streets.lua \
  --middle-schema=osm --cache="${OSM_CACHE_MB:-256}" --log-level=warn \
  -d "$DATABASE_URL" "$filtered"

stage "index"
psql_q <<'SQL'
CREATE INDEX streets_import_geom_gist ON osm.streets_import USING gist (geom);
CREATE INDEX streets_import_name_idx ON osm.streets_import (name);
ANALYZE osm.streets_import;
SQL

# Sanity check (KAN-59): a cut-off download or a broken filter shows up as far fewer rows.
# Keep the current data instead of swapping it out. streets_import stays for inspection;
# the next run drops it. OSM_FORCE_SWAP=1 skips the check for an intended drop (a streets.lua change).
new_rows=$(psql_q -tAc "SELECT count(*) FROM osm.streets_import")
old_rows=0
if [ "$(psql_q -tAc "SELECT to_regclass('osm.streets') IS NOT NULL")" = "t" ]; then
  old_rows=$(psql_q -tAc "SELECT count(*) FROM osm.streets")
fi
min_rows=$(( old_rows * ${OSM_MIN_PERCENT:-90} / 100 ))
stage "rows: new $new_rows, current $old_rows, minimum $min_rows"
if [ "$new_rows" -lt "$min_rows" ] && [ "${OSM_FORCE_SWAP:-}" != "1" ]; then
  echo "ABORT: new import has $new_rows rows, under ${OSM_MIN_PERCENT:-90}% of the current $old_rows." >&2
  echo "osm.streets is unchanged. Rerun with OSM_FORCE_SWAP=1 if the drop is intended." >&2
  exit 1
fi

stage "swap"
# lock_timeout: the DROP needs an exclusive lock, and new /api/streets queries queue behind it
# while it waits. If a long query holds the table, give up after 10 s and keep the old data.
psql_q <<'SQL'
BEGIN;
SET LOCAL lock_timeout = '10s';
DROP TABLE IF EXISTS osm.streets;
ALTER TABLE osm.streets_import RENAME TO streets;
ALTER INDEX osm.streets_import_geom_gist RENAME TO streets_geom_gist;
ALTER INDEX osm.streets_import_name_idx RENAME TO streets_name_idx;
COMMIT;
SQL

psql_q -v url="$PBF_URL" -v ts="${data_ts:-}" -v secs="$(( $(date +%s) - start ))" <<'SQL'
INSERT INTO osm.import_log (source_url, data_timestamp, row_count, total_bytes, seconds)
SELECT :'url', NULLIF(:'ts', '')::timestamptz, count(*), pg_total_relation_size('osm.streets'), :secs
FROM osm.streets;
\pset footer off
SELECT row_count AS rows, pg_size_pretty(total_bytes) AS size, seconds, data_timestamp
FROM osm.import_log ORDER BY id DESC LIMIT 1;
SELECT highway, count(*) AS rows, pg_size_pretty(sum(pg_column_size(geom))) AS geom_size
FROM osm.streets GROUP BY highway ORDER BY count(*) DESC;
SQL
rm -f "$filtered"
stage "done"

peak_mem
