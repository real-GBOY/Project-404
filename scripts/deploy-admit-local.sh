#!/usr/bin/env bash
#
# One-shot manual deploy of the ADMIT BACKEND from a local checkout to the Raqib VPS (Interserver), as its own systemd
# service (admit, :3400) + nginx server block + Postgres database. The web app (admit/web) is on Vercel, not shipped here.
#
#   bash scripts/deploy-admit-local.sh               # build + ship
#   SKIP_BUILD=1 bash scripts/deploy-admit-local.sh  # ship the existing dist/
#
# Needs the one-time box setup first: admit/deploy/provision-vps.sh (see docs/admit-deployment.md).
SSH_KEY="${SSH_KEY:-me}"
SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-162.35.28.116}"
BACKEND_DIR="${BACKEND_DIR:-/opt/admit/backend}"
SERVICE="${SERVICE:-admit}"
PORT="${PORT:-3400}"
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST")
SCP=(scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)
REV="$(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain)" ] && echo "warning: working tree is dirty, deploying it anyway" >&2

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "-> building admit backend ($REV)"
  ( cd admit/backend && npm run build )
fi
[ -f admit/backend/dist/admit/backend/main.js ] || { echo "build missing: run without SKIP_BUILD" >&2; exit 1; }

echo "-> shipping to $SSH_USER@$SSH_HOST"
"${SSH[@]}" "rm -rf /tmp/admit-ship && mkdir -p /tmp/admit-ship"
tar -czf - -C admit/backend/dist . | "${SSH[@]}" "cat > /tmp/admit-ship/backend.tgz"
"${SCP[@]}" package.json package-lock.json admit/backend/deploy-vps.sh scripts/admit-backup.sh admit/backend/scripts/offsite-backup.mjs "$SSH_USER@$SSH_HOST:/tmp/admit-ship/"
printf 'SERVICE=%s\nPORT=%s\n' "$SERVICE" "$PORT" | "${SSH[@]}" "cat > /tmp/admit-ship/deploy.env"

echo "-> releasing on the box"
"${SSH[@]}" "set -e
  mkdir -p '$BACKEND_DIR/dist'
  find '$BACKEND_DIR/dist' -mindepth 1 -delete
  tar --no-same-owner -xzf /tmp/admit-ship/backend.tgz -C '$BACKEND_DIR/dist'
  cp /tmp/admit-ship/package.json /tmp/admit-ship/package-lock.json /tmp/admit-ship/deploy-vps.sh /tmp/admit-ship/deploy.env '$BACKEND_DIR/'
  cp /tmp/admit-ship/admit-backup.sh /opt/admit/admit-backup.sh && cp /tmp/admit-ship/offsite-backup.mjs /opt/admit/offsite-backup.mjs && chmod +x /opt/admit/admit-backup.sh
  rm -rf /tmp/admit-ship
  chown -R admit:admit '$BACKEND_DIR'
  env BACKEND_DIR='$BACKEND_DIR' SERVICE='$SERVICE' PORT='$PORT' bash '$BACKEND_DIR/deploy-vps.sh'
"
echo "deployed admit $REV: https://admit.162-35-28-116.sslip.io/api/health"
