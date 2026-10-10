#!/usr/bin/env bash
#
# Nightly backup of the Admit database, run ON the VPS by cron (see docs/admit-deployment.md): a compressed pg_dump in
# /var/backups/admit, newest 14 kept. Payment proofs live in /opt/admit/storage and are archived with it.
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
tar -czf "$DIR/admit-storage-$DAY.tgz" -C /opt/admit storage 2>/dev/null || true
ls -1t "$DIR"/admit-2*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f
ls -1t "$DIR"/admit-storage-*.tgz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "backup: $FILE ($(du -h "$FILE" | cut -f1))"
