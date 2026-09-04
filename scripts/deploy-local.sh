#!/usr/bin/env bash
#
# One-shot manual deploy from a local checkout to the VPS, for when the CI
# `deploy` job (docs/deployment.md) isn't wired up yet. Builds backend + web at
# the current commit and ships both, so the running site matches your tree.
#
#   bash scripts/deploy-local.sh
#
# Requires: ssh + scp on PATH, and an SSH key that can log in as $SSH_USER.
# Override any of these on the command line:
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
DIRTY="$(git status --porcelain)"
[ -n "$DIRTY" ] && echo "⚠ working tree has uncommitted changes — deploying it anyway" >&2

echo "→ building backend ($REV)"
npm ci --silent
npm run build

echo "→ building web ($REV)"
( cd mizan/web && npm ci --silent && npm run build )

echo "→ uploading to $SSH_USER@$SSH_HOST"
$SSH "rm -rf /tmp/mizan-deploy && mkdir -p /tmp/mizan-deploy/dist /tmp/mizan-deploy/web"
$SCP -r dist/*                                    "$SSH_USER@$SSH_HOST:/tmp/mizan-deploy/dist/"
$SCP    package.json package-lock.json scripts/deploy-vps.sh "$SSH_USER@$SSH_HOST:/tmp/mizan-deploy/"
$SCP -r mizan/web/dist/*                          "$SSH_USER@$SSH_HOST:/tmp/mizan-deploy/web/"

echo "→ releasing on the box (you may be prompted for the sudo password)"
$SSH "set -e
  sudo rsync -a --delete /tmp/mizan-deploy/dist/ '$BACKEND_DIR/dist/'
  sudo cp /tmp/mizan-deploy/package.json /tmp/mizan-deploy/package-lock.json /tmp/mizan-deploy/deploy-vps.sh '$BACKEND_DIR/'
  sudo rsync -a --delete /tmp/mizan-deploy/web/ '$WEB_ROOT/'
  rm -rf /tmp/mizan-deploy
  sudo env BACKEND_DIR='$BACKEND_DIR' SERVICE='$SERVICE' PORT='$PORT' bash '$BACKEND_DIR/deploy-vps.sh'
  sudo systemctl reload nginx || true
"

echo "✓ deployed $REV — check http://$SSH_HOST"
