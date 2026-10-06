#!/usr/bin/env bash
#
# One-shot manual deploy of the RAQIB BACKEND from a local checkout to the shared VPS, as its own systemd
# service (raqib, :3300) + nginx server block + Postgres database. The web app (raqib/web) is on Vercel,
# not shipped here.
#
#   bash scripts/deploy-raqib-local.sh               # build + ship
#   SKIP_BUILD=1 bash scripts/deploy-raqib-local.sh  # ship the existing dist/
#
# Needs the one-time box setup from docs/raqib-deployment.md first.
SSH_KEY="${SSH_KEY:-me}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-100.26.109.162}"
BACKEND_DIR="${BACKEND_DIR:-/opt/raqib}"
SERVICE="${SERVICE:-raqib}"
PORT="${PORT:-3300}"
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST")
SCP=(scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)
REV="$(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain)" ] && echo "⚠ working tree is dirty — deploying it anyway" >&2

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "→ building raqib backend ($REV)"
  npm ci --silent
  ( cd raqib/backend && npm run build )
fi
[ -f raqib/backend/dist/raqib/backend/main.js ] || { echo "✗ build missing — run without SKIP_BUILD" >&2; exit 1; }

echo "→ shipping to $SSH_USER@$SSH_HOST"
tar -czf - -C raqib/backend/dist . | "${SSH[@]}" "cat > /tmp/raqib-backend.tgz"
"${SCP[@]}" package.json package-lock.json raqib/backend/deploy-vps.sh "$SSH_USER@$SSH_HOST:/tmp/"
printf 'SERVICE=%s
PORT=%s
' "$SERVICE" "$PORT" | "${SSH[@]}" "cat > /tmp/raqib-deploy.env"

echo "→ releasing on the box"
"${SSH[@]}" "set -e
  sudo mkdir -p '$BACKEND_DIR/dist'
  sudo find '$BACKEND_DIR/dist' -mindepth 1 -delete
  sudo tar --no-same-owner -xzf /tmp/raqib-backend.tgz -C '$BACKEND_DIR/dist'
  sudo cp /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh '$BACKEND_DIR/'
  sudo cp /tmp/raqib-deploy.env '$BACKEND_DIR/deploy.env'
  rm -f /tmp/raqib-backend.tgz /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh /tmp/raqib-deploy.env
  sudo env BACKEND_DIR='$BACKEND_DIR' SERVICE='$SERVICE' PORT='$PORT' bash '$BACKEND_DIR/deploy-vps.sh'
"
echo "✓ deployed raqib $REV — https://raqib.100-26-109-162.sslip.io/api/health"
