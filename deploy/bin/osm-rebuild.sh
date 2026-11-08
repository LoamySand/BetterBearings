#!/usr/bin/env bash
# Weekly street data rebuild for one BetterBearings environment (KAN-59).
# Usage: osm-rebuild.sh prod|staging
# Runs the osm-import job (deploy/osm/import.sh), which downloads the latest Geofabrik extract,
# builds osm.streets_import, checks its row count and swaps it in. The app serves throughout.
set -euo pipefail

ENV="${1:?usage: osm-rebuild.sh prod|staging}"
cd "/srv/betterbearings/$ENV"

# Heartbeat for Uptime Kuma. "up" after a good swap; "down" on failure, so a failed run alerts
# the same morning instead of when the 8-day push monitor runs out.
push() {
  [ -n "${OSM_PUSH_URL:-}" ] || return 0
  curl -fsS -m 10 -o /dev/null -G --data-urlencode "status=$1" --data-urlencode "msg=$2" "$OSM_PUSH_URL" \
    || echo "heartbeat to Uptime Kuma failed" >&2
}

# -T: systemd gives no TTY. Extra arguments go to "docker compose run", e.g. -e OSM_FORCE_SWAP=1
if docker compose run --rm -T "${@:2}" osm-import; then
  push up ok
else
  rc=$?
  push down "osm-import exited $rc"
  exit "$rc"
fi
