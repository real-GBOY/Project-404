#!/usr/bin/env bash
#
# One-shot manual deploy of ATLAS (not Mizan — see scripts/deploy-local.sh for
# that) from a local checkout to the same VPS Mizan runs on, as a second,
# independent systemd service + nginx server block + Postgres database. Builds
# atlas/backend + atlas/web at the current commit and ships both.
#
#   bash scripts/deploy-atlas-local.sh              # build + ship
#   SKIP_BUILD=1 bash scripts/deploy-atlas-local.sh # ship the existing dist/ folders
#
# Requires: ssh + tar on PATH, and an SSH key that can log in as $SSH_USER with
# passwordless sudo on the box. Requires the one-time box setup in
# docs/atlas-deployment.md to have been done first (database, systemd unit,
# nginx server block, TLS cert, /opt/atlas/.env) — this script only ships code
# and restarts the service, exactly like scripts/deploy-vps.sh does for Mizan.
SSH_KEY="${SSH_KEY:-me}"                       # private key file (repo root)
SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-100.26.109.162}"
BACKEND_DIR="${BACKEND_DIR:-/opt/atlas}"
WEB_ROOT="${WEB_ROOT:-/var/www/atlas}"
SERVICE="${SERVICE:-atlas}"
PORT="${PORT:-3100}"
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
# Arrays, not strings — a plain `SSH="ssh -i $SSH_KEY …"` word-splits on any
# space in $SSH_KEY (e.g. an absolute path through this repo's own directory
# name, "Project 404"), silently truncating the host argument.
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST")
SCP=(scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)
REV="$(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain)" ] && echo "⚠ working tree is dirty — deploying it anyway" >&2

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "→ building atlas backend ($REV)"
  npm ci --silent                              # root node_modules — atlas/backend has no own deps
  ( cd atlas/backend && npm run build )
  echo "→ building atlas web ($REV)"
  ( cd atlas/web && npm ci --silent && npm run build )
fi
[ -f atlas/backend/dist/atlas/backend/main.js ] || { echo "✗ atlas/backend/dist missing — run without SKIP_BUILD" >&2; exit 1; }
[ -f atlas/web/dist/index.html ] || { echo "✗ atlas/web/dist missing — run without SKIP_BUILD" >&2; exit 1; }

# atlas/backend deliberately ships no package.json of its own (it hoists onto
# the repo root's node_modules in dev — see the "comment_dependencies" note in
# atlas/backend/package.json). For a self-contained deploy it needs A
# package.json + lockfile that `npm ci` can install from — reuse the ROOT
# package.json/package-lock.json unchanged: Atlas already runs on exactly
# these versions (same Core, same Nest/Fastify/Kysely/Prisma stack Mizan's own
# deploy already installs and proves working), so there is no separate
# dependency set to maintain or drift.
echo "→ shipping atlas backend + web to $SSH_USER@$SSH_HOST"
tar -czf - -C atlas/backend/dist . | "${SSH[@]}" "cat > /tmp/atlas-backend.tgz"
tar -czf - -C atlas/web/dist . | "${SSH[@]}" "cat > /tmp/atlas-web.tgz"
"${SCP[@]}" package.json package-lock.json atlas/backend/deploy-vps.sh "$SSH_USER@$SSH_HOST:/tmp/"
printf 'SERVICE=%s\nPORT=%s\n' "$SERVICE" "$PORT" | "${SSH[@]}" "cat > /tmp/atlas-deploy.env"

echo "→ releasing on the box"
"${SSH[@]}" "set -e
  sudo mkdir -p '$BACKEND_DIR/dist' '$WEB_ROOT'
  sudo find '$BACKEND_DIR/dist' -mindepth 1 -delete
  sudo tar --no-same-owner -xzf /tmp/atlas-backend.tgz -C '$BACKEND_DIR/dist'
  sudo cp /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh '$BACKEND_DIR/'
  sudo cp /tmp/atlas-deploy.env '$BACKEND_DIR/deploy.env'
  sudo find '$WEB_ROOT' -mindepth 1 -delete
  sudo tar --no-same-owner -xzf /tmp/atlas-web.tgz -C '$WEB_ROOT'
  rm -f /tmp/atlas-backend.tgz /tmp/atlas-web.tgz /tmp/package.json /tmp/package-lock.json /tmp/deploy-vps.sh /tmp/atlas-deploy.env
  sudo env BACKEND_DIR='$BACKEND_DIR' SERVICE='$SERVICE' PORT='$PORT' bash '$BACKEND_DIR/deploy-vps.sh'
  sudo systemctl reload nginx || true
"

echo "✓ deployed atlas $REV — check https://atlas.100-26-109-162.sslip.io"
