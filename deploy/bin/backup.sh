#!/usr/bin/env bash
# Nightly logical backup of one BetterBearings environment.
# Usage: backup.sh prod|staging
set -euo pipefail

ENV="${1:?usage: backup.sh prod|staging}"
APP_DIR="/srv/betterbearings/$ENV"
DEST="${BACKUP_DIR:-/srv/backups/betterbearings}/$ENV"
KEEP_DAYS=14
FILE="$DEST/betterbearings-$ENV-$(date -u +%Y%m%dT%H%M%SZ).dump"

umask 077                      # dumps hold emails and password hashes
mkdir -p "$DEST"
rm -f "$DEST"/*.partial        # leftovers from a run that failed

cd "$APP_DIR"
# --exclude-schema=osm: street data is rebuilt from Geofabrik by osm-import, so it stays out of backups.
# -T: no TTY, so binary output isn't mangled. -Fc: compressed custom format for pg_restore.
# If pg_dump or the write fails (disk full, db down), set -e stops here and the .partial is never renamed.
docker compose exec -T db pg_dump -U bb -d betterbearings -Fc --exclude-schema=osm > "$FILE.partial"

# Cheap sanity check: read the whole archive without restoring it. Catches gross corruption,
# not every truncation; restore-test.sh is the real proof.
docker compose exec -T db pg_restore -f /dev/null < "$FILE.partial"
mv "$FILE.partial" "$FILE"

# Prune only after a good dump: if every run starts failing, old backups stay put
find "$DEST" -name '*.dump' -mtime +$((KEEP_DAYS - 1)) -delete

echo "ok $FILE $(du -h "$FILE" | cut -f1), $(find "$DEST" -name '*.dump' | wc -l) dumps kept"

# Heartbeat for Uptime Kuma. Only a successful run reaches this line, so a missing heartbeat is the alert.
if [ -n "${BACKUP_PUSH_URL:-}" ]; then
  curl -fsS -m 10 -o /dev/null "$BACKUP_PUSH_URL?status=up&msg=ok" || echo "heartbeat to Uptime Kuma failed" >&2
fi