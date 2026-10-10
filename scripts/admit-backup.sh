#!/usr/bin/env bash
#
# Nightly backup of the Admit database, run ON the VPS by cron (see docs/admit-deployment.md):
#   1. a verified pg_dump -Fc into /var/backups/admit (newest 14 kept), on this machine;
#   2. the same dump copied OFF the machine into Cloudflare R2 (bucket admit-files, folder backups/, newest 14 days kept), so losing the
#      server does not lose the data. The copy is read back and its size checked before it counts.
# Payment proofs are not in the dump: they already live in R2.
#
#   sudo bash /opt/admit/admit-backup.sh
set -euo pipefail

DIR="${BACKUP_DIR:-/var/backups/admit}"
KEEP="${KEEP:-14}"
DAY="$(date -u +%F)"
FILE="$DIR/admit-$DAY.dump"

mkdir -p "$DIR"
chmod 700 "$DIR"

sudo -u postgres pg_dump -Fc admit > "$FILE.tmp"
pg_restore -l "$FILE.tmp" > /dev/null          # a dump that cannot be read back is not a backup
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
ls -1t "$DIR"/admit-2*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "local backup: $FILE ($(du -h "$FILE" | cut -f1))"

# the off-machine copy (credentials come from the service's own environment file)
set -a
. /opt/admit/backend/.env
set +a
KEEP="$KEEP" node /opt/admit/offsite-backup.mjs "$FILE" "admit-$DAY.dump"
