#!/usr/bin/env bash
# Deploys one image tag to one environment. CI calls it over SSH as a forced command, so the
# deploy key can run this script and nothing else.
# Usage: deploy.sh staging|prod sha-abc1234   (over SSH the arguments arrive in SSH_ORIGINAL_COMMAND)
set -euo pipefail

read -r ENV TAG EXTRA <<< "${SSH_ORIGINAL_COMMAND:-$*}"
case "$ENV" in staging|prod) ;; *) echo "unknown environment: '$ENV'" >&2; exit 2 ;; esac
[[ "$TAG" =~ ^sha-[0-9a-f]{7}$ ]] || { echo "bad image tag: '$TAG'" >&2; exit 2; }
[ -z "${EXTRA:-}" ] || { echo "unexpected arguments" >&2; exit 2; }

cd "/srv/betterbearings/$ENV"
PREV="$(sed -n 's/^IMAGE_TAG=\([^ #]*\).*/\1/p' .env)"
echo "deploying $TAG to $ENV (was $PREV)"

set_tag() { sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env; }   # GNU sed -i keeps the file's mode and owner

wait_healthy() {
  local id status
  id="$(docker compose ps -q app)"
  for _ in $(seq 60); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$id" 2> /dev/null || echo missing)"
    [ "$status" = healthy ] && return 0
    sleep 2
  done
  echo "app not healthy after 120 s (last status: $status)" >&2
  return 1
}

docker pull --quiet "ghcr.io/loamysand/betterbearings:$TAG" > /dev/null
set_tag "$TAG"
# Migrations run first (migrate service); app is only recreated if they exit 0
if docker compose up -d --remove-orphans && wait_healthy; then
  echo "ok $ENV is on $TAG"
else
  docker compose logs --tail 50 migrate app >&2 || true
  if [ -n "$PREV" ] && [ "$PREV" != "$TAG" ]; then
    echo "rolling back to $PREV (any migration that already ran stays applied)" >&2
    set_tag "$PREV"
    docker compose up -d && wait_healthy || echo "rollback is unhealthy too; check by hand" >&2
  fi
  exit 1
fi

# Keep the disk from filling with old builds: drop this project's unused images older than 14 days
docker image prune -af --filter "until=336h" \
  --filter "label=org.opencontainers.image.source=https://github.com/LoamySand/BetterBearings" > /dev/null