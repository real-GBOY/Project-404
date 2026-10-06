#!/usr/bin/env bash
#
# Nightly backup of the Raqib database, run ON the VPS by cron (see docs/raqib-deployment.md). It writes a compressed
# pg_dump to /var/backups/raqib (newest 14 kept) and copies it off the machine into R2 under backups/ (newest 14 days
# kept there), so losing the server does not lose the data. Restoring is documented next to the install steps.
#
#   sudo bash /opt/raqib/raqib-backup.sh
set -euo pipefail

DIR="${BACKUP_DIR:-/var/backups/raqib}"
KEEP="${KEEP:-14}"
DB="${DB:-raqib}"
DAY="$(date -u +%F)"
FILE="$DIR/raqib-$DAY.dump"

mkdir -p "$DIR"
chmod 700 "$DIR"

sudo -u postgres pg_dump -Fc "$DB" > "$FILE.tmp"
pg_restore -l "$FILE.tmp" > /dev/null          # a dump that cannot be read back is not a backup
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
ls -1t "$DIR"/raqib-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "local backup: $FILE ($(du -h "$FILE" | cut -f1))"

# the off-machine copy (credentials come from the service's own environment file)
set -a
. /opt/raqib/.env
set +a
KEEP="$KEEP" node /opt/raqib/offsite-backup.mjs "$FILE" "raqib-$DAY.dump"
