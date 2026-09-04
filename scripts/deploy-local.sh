#!/usr/bin/env bash
#
# One-shot manual deploy from a local checkout to the VPS, for when the CI
# `deploy` job (docs/deployment.md) isn't wired up yet. Builds backend + web at
# the current commit and ships both, so the running site matches your tree.
#
#   bash scripts/deploy-local.sh              # build + ship
#   SKIP_BUILD=1 bash scripts/deploy-local.sh # ship the existing dist/ folders
#
# Requires: ssh + tar on PATH, and an SSH key that can log in as $SSH_USER with
# passwordless sudo on the box. Override any of these:
SSH_KEY="${SSH_KEY:-me}"                       # private key file (repo root)
SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-13.220.157.42}"
BACKEND_DIR="${BACKEND_DIR:-/opt/mizan}"
WEB_ROOT="${WEB_ROOT:-/var/www/mizan}"
SERVICE="${SERVICE:-mizan}"
PORT="${PORT:-3000}"
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $SSH_USER@$SSH_HOST"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
REV="$(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain)" ] && echo "⚠ working tree is dirty — deploying it anyway" >&2

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "→ building backend ($REV)"
  npm ci --silent
  npm run build
  echo "→ building web ($REV)"
  ( cd mizan/web && npm ci --silent && npm run build )
fi
[ -f dist/main.js ] || { echo "✗ dist/main.js missing — run without SKIP_BUILD" >&2; exit 1; }
[ -f mizan/web/dist/index.html ] || { echo "✗ mizan/web/dist missing — run without SKIP_BUILD" >&2; exit 1; }

# Transfer as two tar streams (one ssh round-trip each) — scp of the many small
# backend files crawls on this box, and it has no rsync.
echo "→ shipping backend + web to $SSH_USER@$SSH_HOST"
tar -czf - -C dist . | $SSH "cat > /tmp/mizan-backend.tgz"
tar -czf - -C mizan/web/dist . | $SSH "cat > /tmp/mizan-web.tgz"
$SCP package.json package-lock.json scripts/deploy-vps.sh "$SSH_USER@$SSH_HOST:/tmp/"

echo "→ releasing on the box"
$SSH "set -e
  sudo mkdir -p '$BACKEND_DIR/dist' '$WEB_ROOT'
  sudo find '$BACKEND_DIR/dist' -mindepth 1 -delete
  sudo tar --no-same-owner -xzf /tmp/mizan-backend.tgz -C '$BACKEND_DIR/dist'
  sudo cp /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh '$BACKEND_DIR/'
  sudo find '$WEB_ROOT' -mindepth 1 -delete
  sudo tar --no-same-owner -xzf /tmp/mizan-web.tgz -C '$WEB_ROOT'
  rm -f /tmp/mizan-backend.tgz /tmp/mizan-web.tgz /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh
  sudo env BACKEND_DIR='$BACKEND_DIR' SERVICE='$SERVICE' PORT='$PORT' bash '$BACKEND_DIR/deploy-vps.sh'
  sudo systemctl reload nginx || true
"

echo "✓ deployed $REV — check http://$SSH_HOST"
