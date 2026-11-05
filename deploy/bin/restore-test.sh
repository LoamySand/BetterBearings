#!/usr/bin/env bash
# Restores a dump into a throwaway PostGIS container and compares row counts with the live database.
# Usage: restore-test.sh prod|staging [dump file]   (default: newest dump)
set -euo pipefail

ENV="${1:?usage: restore-test.sh prod|staging [dump file]}"
APP_DIR="/srv/betterbearings/$ENV"
DEST="${BACKUP_DIR:-/srv/backups/betterbearings}/$ENV"
DUMP="${2:-$(printf '%s\n' "$DEST"/*.dump | tail -1)}"   # names are UTC timestamps, so last = newest
NAME="bb-restore-test"
COUNTS="SELECT 'users', count(*) FROM users
  UNION ALL SELECT 'street_sets', count(*) FROM street_sets
  UNION ALL SELECT 'street_set_streets', count(*) FROM street_set_streets
  UNION ALL SELECT 'valid_geometries', count(*) FROM street_set_streets WHERE ST_IsValid(geom)
  UNION ALL SELECT 'migrations', count(*) FROM pgmigrations
  ORDER BY 1"

echo "Restoring $DUMP"
docker rm -f "$NAME" > /dev/null 2>&1 || true
trap 'docker rm -f "$NAME" > /dev/null 2>&1 || true' EXIT

# --network none: the scratch server can't be reached, and can't reach anything
docker run -d --name "$NAME" --network none \
  -e POSTGRES_USER=bb -e POSTGRES_PASSWORD=restore-test -e POSTGRES_DB=postgres \
  postgis/postgis:17-3.5 > /dev/null

# TCP on 127.0.0.1 only answers once init is finished; the init-time server is socket-only
until docker exec "$NAME" psql -h 127.0.0.1 -U bb -d postgres -qtAc 'SELECT 1' > /dev/null 2>&1; do sleep 1; done

# template0 = an empty database, like a brand-new server. The dump must recreate PostGIS itself.
docker exec "$NAME" createdb -h 127.0.0.1 -U bb -T template0 restored
docker exec -i "$NAME" pg_restore -h 127.0.0.1 -U bb -d restored --no-owner --exit-on-error < "$DUMP"

TMP="$(mktemp -d)"
trap 'docker rm -f "$NAME" > /dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
docker exec "$NAME" psql -h 127.0.0.1 -U bb -d restored -qtAF ' ' -c "$COUNTS" > "$TMP/restored"
(cd "$APP_DIR" && docker compose exec -T db psql -U bb -d betterbearings -qtAF ' ' -c "$COUNTS") > "$TMP/live"

# Same query, same ORDER BY, so the lines line up
echo; { echo "table restored live"; paste -d ' ' "$TMP/restored" <(cut -d ' ' -f 2 "$TMP/live"); } | awk '{ printf "%-20s %9s %6s\n", $1, $2, $3 }'
if diff -q "$TMP/restored" "$TMP/live" > /dev/null; then
  echo; echo "PASS: restored counts match live"
else
  echo; echo "MISMATCH: expected only if someone wrote to the live database after the dump"
  exit 1
fi