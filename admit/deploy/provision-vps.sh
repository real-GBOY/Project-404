#!/usr/bin/env bash
#
# One-time setup of the Admit stack on the Raqib VPS (Ubuntu with Postgres, nginx, certbot and Node already installed for Raqib).
# Run ON the box as root. Idempotent. Creates: system user `admit`, database `admit`, /opt/admit/{backend,worker,storage},
# /opt/admit/backend/.env (random secrets, reusing the box's shared auric_app / auric_system roles), the admit and
# admit-worker systemd units and the nginx server block + TLS certificate. It never prints a secret.
#
#   bash provision-vps.sh <api-host> <web-origin>
#   bash provision-vps.sh admit.162-35-28-116.sslip.io https://admit-web-lime.vercel.app
#
# Afterwards ship the code: scripts/deploy-admit-local.sh (API) and the worker copy described in docs/admit-deployment.md.
set -euo pipefail
API_HOST="${1:?api host, e.g. admit.162-35-28-116.sslip.io}"
WEB_ORIGIN="${2:?web origin, e.g. https://admit-web-lime.vercel.app}"
RAQIB_ENV=/opt/raqib/.env
ENV_FILE=/opt/admit/backend/.env
HERE="$(cd "$(dirname "$0")" && pwd)"

id admit >/dev/null 2>&1 || useradd --system --home /opt/admit --shell /usr/sbin/nologin admit
mkdir -p /opt/admit/backend /opt/admit/worker /opt/admit/storage/files

# Database: its own, created by the postgres superuser.
if ! sudo -u postgres psql -Atc "select 1 from pg_database where datname='admit'" | grep -q 1; then
  sudo -u postgres createdb admit
fi

if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f "$RAQIB_ENV" ]] || { echo "$RAQIB_ENV not found: the shared role passwords are read from it" >&2; exit 1; }
  swap_db() { grep -E "^$1=" "$RAQIB_ENV" | head -1 | cut -d= -f2- | sed -E 's#/raqib([?]|$)#/admit\1#'; }
  umask 077
  {
    echo "NODE_ENV=production"
    echo "AURIC_PORT=3400"
    echo "AURIC_HOST=127.0.0.1"
    echo "AURIC_LOG_LEVEL=info"
    echo "AURIC_DATABASE_URL=$(swap_db AURIC_DATABASE_URL)"
    echo "AURIC_APP_DATABASE_URL=$(swap_db AURIC_APP_DATABASE_URL)"
    echo "AURIC_SYSTEM_DATABASE_URL=$(swap_db AURIC_SYSTEM_DATABASE_URL)"
    echo "AURIC_JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
    echo "ADMIT_TICKET_KEY=$(openssl rand -base64 32 | tr -d '\n')"
    echo "AURIC_APP_NAME=Admit"
    echo "AURIC_APP_URL=$WEB_ORIGIN"
    echo "AURIC_CORS_ORIGINS=$WEB_ORIGIN,*.vercel.app"
    echo "AURIC_SELF_SIGNUP=false"
    echo "AURIC_DOCS_ENABLED=false"
    echo "AURIC_FILE_STORAGE_DRIVER=local"
    echo "AURIC_FILE_STORAGE_PATH=/opt/admit/storage/files"
    echo "ADMIT_PUBLIC_URL=$WEB_ORIGIN"
    echo "ADMIT_API_URL=https://$API_HOST"
    echo "ADMIT_TRUSTED_PROXY_HOPS=1"
    echo "ADMIT_SEED_DEMO=true"
    echo "ADMIT_ALLOW_DEMO_IN_PRODUCTION=true"
  } > "$ENV_FILE"
  echo "wrote $ENV_FILE (secrets generated on the box; back up ADMIT_TICKET_KEY)"
fi
chown -R admit:admit /opt/admit
chmod 600 "$ENV_FILE"

# systemd units (the ones in this folder; the API gets a heap cap for the small box)
cp "$HERE/admit-api.service" /etc/systemd/system/admit.service
sed -i 's#^ExecStart=.*#ExecStart=/usr/bin/node --enable-source-maps dist/admit/backend/main.js#; /^User=/i Environment=NODE_OPTIONS=--max-old-space-size=300' /etc/systemd/system/admit.service
cp "$HERE/admit-worker.service" /etc/systemd/system/admit-worker.service
systemctl daemon-reload
systemctl enable admit >/dev/null 2>&1

# nginx: API only (the web app is on Vercel); the root sends browsers to the web app
cat > /etc/nginx/sites-available/admit <<NGINX
server {
  server_name $API_HOST;
  client_max_body_size 20m;

  location /api/ {
    proxy_pass http://127.0.0.1:3400;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;
  }
  location / { return 302 $WEB_ORIGIN; }
  listen 80;
}
NGINX
ln -sf /etc/nginx/sites-available/admit /etc/nginx/sites-enabled/admit
nginx -t && systemctl reload nginx
if [[ ! -d "/etc/letsencrypt/live/$API_HOST" ]]; then
  certbot --nginx -d "$API_HOST" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi
echo "provisioned. Next: ship the API (scripts/deploy-admit-local.sh) and the worker (docs/admit-deployment.md)."
