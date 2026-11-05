#!/usr/bin/env bash
# Weekly offsite copy: encrypts the newest dump with age and uploads it to Google Drive.
# Usage: offsite.sh prod|staging
set -euo pipefail

ENV="${1:?usage: offsite.sh prod|staging}"
DEST="${BACKUP_DIR:-/srv/backups/betterbearings}/$ENV"
RECIPIENTS="/srv/betterbearings/bin/backup-recipients.txt"   # age public key(s); the private key never lives here
REMOTE="${OFFSITE_REMOTE:-gdrive-backup:BetterBearings-backups}/$ENV"
KEEP_DAYS=56                                                 # 8 weekly copies

DUMP="$(printf '%s\n' "$DEST"/*.dump | tail -1)"             # names are UTC timestamps, so last = newest
[ -f "$DUMP" ] || { echo "no dump in $DEST" >&2; exit 1; }

# Refuse to ship a stale copy: the nightly job should have run within the last 2 days
if [ -z "$(find "$DUMP" -mmin -2880)" ]; then
  echo "newest dump $DUMP is older than 2 days; check betterbearings-backup@$ENV" >&2
  exit 1
fi

NAME="$(basename "$DUMP").age"
# Encrypt on the way out; no plaintext copy leaves the ProDesk
age -R "$RECIPIENTS" "$DUMP" | rclone rcat "$REMOTE/$NAME"

# Confirm the upload landed with a non-zero size before pruning anything
SIZE="$(rclone size --json "$REMOTE/$NAME" | grep -o '"bytes":[0-9]*' | cut -d: -f2)"
[ "${SIZE:-0}" -gt 0 ] || { echo "upload of $NAME looks empty" >&2; exit 1; }

rclone delete --min-age "${KEEP_DAYS}d" "$REMOTE"
echo "ok uploaded $REMOTE/$NAME ($SIZE bytes)"