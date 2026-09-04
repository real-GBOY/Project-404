#!/usr/bin/env bash
#
# Runs ON the VPS as root (the CI `deploy` job calls it via `sudo`), after the
# workflow has rsync'd a fresh build into place. Idempotent; safe to run by hand:
#
#   sudo bash /opt/mizan/deploy-vps.sh
#
# The workflow has already placed, in the backend directory (this script's own
# location):
#   dist/                fresh backend build (tsc output, Prisma staged inside)
#   package.json, package-lock.json
#   deploy-vps.sh        this script
#   deploy.env           optional: SERVICE=… / PORT=… overrides
# and refreshed the web bundle under the nginx root.
#
# It never touches $BACKEND_DIR/.env — secrets live only on the box.
set -euo pipefail

# This script is rsync'd into the backend directory, so its own location is that
# directory. `deploy.env` (also rsync'd next to it) may override SERVICE / PORT.
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$SELF_DIR}"
[[ -f "$BACKEND_DIR/deploy.env" ]] && . "$BACKEND_DIR/deploy.env"
SERVICE="${SERVICE:-mizan}"
PORT="${PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

cd "$BACKEND_DIR"

# --- production dependencies -------------------------------------------------
# Only reinstall when the lockfile actually changed since the last deploy —
# npm ci wipes node_modules and the box is small. argon2 and the Prisma engines
# have native install scripts; this npm (11.x) skips lifecycle scripts unless
# they are allow-listed, so run them explicitly and then verify.
STAMP=".deploy-lockfile.sha256"
NEW_SUM="$(sha256sum package-lock.json | awk '{print $1}')"
node_ok() {
  [[ -d node_modules/prisma ]] && node -e "require('argon2')" >/dev/null 2>&1
}
if [[ -f "$STAMP" && "$(cat "$STAMP")" == "$NEW_SUM" ]]; then
  echo "→ dependencies unchanged — skipping npm ci"
elif [[ ! -f "$STAMP" ]] && node_ok; then
  # First run onto a box whose node_modules already works (e.g. a prior manual
  # deploy) and whose lockfile matches — adopt it instead of a needless reinstall.
  echo "→ existing node_modules already resolves — adopting without npm ci"
  echo "$NEW_SUM" > "$STAMP"
else
  echo "→ installing production dependencies — npm ci --omit=dev"
  npm ci --omit=dev --no-audit --no-fund --unsafe-perm --foreground-scripts
  # Belt and braces: force the native builds in case scripts were skipped.
  npm rebuild --omit=dev argon2 prisma @prisma/engines >/dev/null 2>&1 || true
  echo "$NEW_SUM" > "$STAMP"
fi

# Fail early with a clear message if a native dep did not build.
node -e "require('argon2')" 2>/dev/null \
  || { echo "✗ argon2 failed to load — run 'npm rebuild argon2' in $BACKEND_DIR" >&2; exit 1; }

# --- restart ---------------------------------------------------------------
# Pending migrations are applied by the process on boot
# (main.ts → migrateToLatest), so the restart is the whole cutover.
echo "→ restarting $SERVICE"
systemctl restart "$SERVICE"

# --- health gate ---------------------------------------------------------------
echo "→ waiting for $HEALTH_URL"
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "✓ $SERVICE healthy after ${i} attempt(s)"
    exit 0
  fi
  sleep 2
done

echo "✗ $SERVICE did not pass its health check — recent logs:" >&2
systemctl status "$SERVICE" --no-pager -l 2>&1 | tail -n 40 >&2 || true
journalctl -u "$SERVICE" --no-pager -n 60 2>&1 >&2 || true
exit 1
