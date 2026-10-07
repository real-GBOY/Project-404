#!/usr/bin/env bash
#
# One-shot manual deploy of the HotelOS BACKEND from a local checkout to the shared VPS, as its own
# systemd service (hotelos, :3200) + nginx server block + Postgres database. The staff app
# (hotel-project/app) and public site (hotel-project/web) are on Vercel, not shipped here.
#
#   bash scripts/deploy-hotel-local.sh               # build + ship
#   SKIP_BUILD=1 bash scripts/deploy-hotel-local.sh  # ship the existing dist/
#
# Needs the one-time box setup from docs/hotelos-deployment.md first.
SSH_KEY="${SSH_KEY:-me}"
SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-162.35.28.116}"
BACKEND_DIR="${BACKEND_DIR:-/opt/hotelos}"
SERVICE="${SERVICE:-hotelos}"
PORT="${PORT:-3200}"
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST")
SCP=(scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)
REV="$(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain)" ] && echo "⚠ working tree is dirty — deploying it anyway" >&2

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "→ building hotel backend ($REV)"
  npm ci --silent
  ( cd hotel-project/backend && npm run build )
fi
[ -f hotel-project/backend/dist/hotel-project/backend/main.js ] || { echo "✗ build missing — run without SKIP_BUILD" >&2; exit 1; }

echo "→ shipping to $SSH_USER@$SSH_HOST"
tar -czf - -C hotel-project/backend/dist . | "${SSH[@]}" "cat > /tmp/hotelos-backend.tgz"
"${SCP[@]}" package.json package-lock.json hotel-project/backend/deploy-vps.sh "$SSH_USER@$SSH_HOST:/tmp/"
printf 'SERVICE=%s\nPORT=%s\n' "$SERVICE" "$PORT" | "${SSH[@]}" "cat > /tmp/hotelos-deploy.env"

echo "→ releasing on the box"
"${SSH[@]}" "set -e
  sudo mkdir -p '$BACKEND_DIR/dist'
  sudo find '$BACKEND_DIR/dist' -mindepth 1 -delete
  sudo tar --no-same-owner -xzf /tmp/hotelos-backend.tgz -C '$BACKEND_DIR/dist'
  sudo cp /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh '$BACKEND_DIR/'
  sudo cp /tmp/hotelos-deploy.env '$BACKEND_DIR/deploy.env'
  rm -f /tmp/hotelos-backend.tgz /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh /tmp/hotelos-deploy.env
  sudo env BACKEND_DIR='$BACKEND_DIR' SERVICE='$SERVICE' PORT='$PORT' bash '$BACKEND_DIR/deploy-vps.sh'
"
echo "✓ deployed hotelos $REV — https://hotel.162-35-28-116.sslip.io/api/health"
