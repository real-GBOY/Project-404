# Atlas deployment

Atlas runs on the **same VPS as Mizan** (`docs/deployment.md`), as a fully
independent second service — its own systemd unit, its own nginx server
block, its own Postgres database, its own `.env`. It does **not** share a
process, a port, or a database with Mizan; the two are only related by both
being built on `core/`. Nothing here touches Mizan's running service.

**Box:** the same AWS EC2 `t4g` (ARM64) instance as Mizan —
`ubuntu@100.26.109.162`, 921 MB RAM + 2 GB swap. **This is a small box already
running Mizan + Postgres + nginx.** Before deploying, check headroom
(`free -h`, `df -h`) — a second Node process is a real addition on a box this
size, not a rounding error.

Unlike Mizan (API on the VPS, web on Vercel, cross-origin), **Atlas's web
bundle always calls `/api` same-origin** (`atlas/web/src/config/env.ts` hardcodes
`API_BASE_URL = "/api"`, no `VITE_API_BASE`) — so Atlas's web and API live
under **one hostname**, nginx routes `/api/*` to the Node process and
everything else to the static SPA, and there is no CORS configuration to do.

**Hostname:** `sslip.io` resolves `<anything>.<ip-with-dashes>.sslip.io` to
that IP, so Atlas gets its own free TLS-able hostname on the same box without
a second domain or a second IP: **`atlas.100-26-109-162.sslip.io`**.

## One-time setup

### 1. Postgres — a new, separate database

Same cluster as Mizan's, new database, reusing the same `auric_app` /
`auric_system` **roles** (they're cluster-wide Postgres roles, not
per-database — Atlas's own `..._multitenancy_rls` migration grants them
privileges scoped to *this* database's tables only; a role connected to
`atlas` has no access to anything in Mizan's `auric` database, and vice
versa — Postgres databases are a hard boundary, stronger than a schema).

```bash
sudo -u postgres createdb atlas
```

Point Atlas's `.env` (below) at it with the schema-owner connection first
(`AURIC_DATABASE_URL`), run migrations once by hand to prove it, then switch to
the RLS-enforced app/system role URLs:

```bash
cd /opt/atlas
AURIC_DATABASE_URL=postgres://postgres:<pw>@localhost:5432/atlas node dist/atlas/backend/scripts/migrate.js
```

If `auric_app` / `auric_system` don't already have a login password (they will,
if Mizan is already running provisioned — same cluster, same roles), set one
from the **root** package (its `provision-db` script is product-agnostic — it
just needs a superuser `AURIC_DATABASE_URL` and doesn't touch anything outside
the two role objects):

```bash
cd /opt/mizan   # or any checkout with the root package installed
AURIC_DATABASE_URL=postgres://postgres:<pw>@localhost:5432/atlas \
AURIC_APP_DB_PASSWORD=<same as Mizan's> AURIC_SYSTEM_DB_PASSWORD=<same as Mizan's> \
  npm run provision-db
```

### 2. `/opt/atlas/.env` (mode 600, never committed)

```bash
sudo mkdir -p /opt/atlas
sudo tee /opt/atlas/.env > /dev/null <<'EOF'
NODE_ENV=production
AURIC_PORT=3100
AURIC_LOG_LEVEL=info

AURIC_APP_DATABASE_URL=postgres://auric_app:<pw>@localhost:5432/atlas
AURIC_SYSTEM_DATABASE_URL=postgres://auric_system:<pw>@localhost:5432/atlas

# Atlas's OWN secret — deliberately not shared with Mizan's; an Atlas token
# must never validate against Mizan's backend or vice versa.
AURIC_JWT_SECRET=<generate a new one — do not reuse Mizan's>
AURIC_ACCESS_TOKEN_TTL=900
AURIC_REFRESH_TOKEN_TTL=2592000

AURIC_DEFAULT_LOCALE=en
AURIC_SUPPORTED_LOCALES=en

# Demo dataset (leads/units/reservations/… for a fictional developer) — unset
# for a real deployment.
ATLAS_SEED_DEMO=true

# Groq/OpenAI-compatible key for Atlas Copilot — see core/assistant/README.md.
# Unset disables the AI Copilot endpoint gracefully, it doesn't crash boot.
GROQ_API_KEY=<key>
EOF
sudo chmod 600 /opt/atlas/.env
```

### 3. systemd unit — `/etc/systemd/system/atlas.service`

Same shape as Mizan's `mizan.service`, different port/paths/entrypoint (see
`scripts/build.mjs` for why the compiled entrypoint is nested under
`dist/atlas/backend/`, not `dist/main.js`):

```ini
[Unit]
Description=Atlas RE OS backend
After=network.target postgresql.service

[Service]
User=auric
WorkingDirectory=/opt/atlas
EnvironmentFile=/opt/atlas/.env
ExecStart=/usr/local/bin/node dist/atlas/backend/main.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable atlas
```

(Reuses the same `auric` OS user Mizan runs as — it already owns the right
groups/permissions on this box. Give Atlas its own OS user instead if you want
process-level isolation between the two; nothing else here assumes `auric`
specifically.)

### 4. nginx server block — `/etc/nginx/sites-available/atlas`

```nginx
server {
    listen 80;
    server_name atlas.100-26-109-162.sslip.io;

    root /var/www/atlas;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback — client-side routing.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/atlas /etc/nginx/sites-enabled/atlas
sudo nginx -t && sudo systemctl reload nginx
```

### 5. TLS

Same `certbot` flow as Mizan's, a second `-d`:

```bash
sudo certbot --nginx -d atlas.100-26-109-162.sslip.io --non-interactive --agree-tos \
  -m <admin-email> --redirect
```

### 6. sudoers (if `ubuntu` isn't already fully passwordless — it is on stock
   AWS Ubuntu images, same note as `docs/deployment.md` §4)

```
# /etc/sudoers.d/atlas-deploy   (visudo -f, mode 0440)
ubuntu ALL=(root) NOPASSWD: /bin/mkdir, /usr/bin/find, /bin/tar, /bin/cp, \
  /bin/bash /opt/atlas/deploy-vps.sh, /bin/systemctl reload nginx
```

## Deploying

No CI job yet (`README.md` § Continuous integration — Atlas isn't in `.github/workflows/ci.yml`).
Deploy by hand with the bundled script, which builds `atlas/backend` +
`atlas/web` at the current commit and ships both — the running site matches
your tree:

```bash
bash scripts/deploy-atlas-local.sh              # build + ship
SKIP_BUILD=1 bash scripts/deploy-atlas-local.sh # ship the existing dist/ folders
```

Override any of `SSH_KEY` / `SSH_USER` / `SSH_HOST` / `BACKEND_DIR` /
`WEB_ROOT` / `SERVICE` / `PORT` as env vars. It ships `atlas/backend/dist`
(the whole tree — the real entrypoint is `dist/atlas/backend/main.js`), plus
the **root** `package.json` / `package-lock.json` (atlas/backend
deliberately has none of its own — see the `comment_dependencies` note in
`atlas/backend/package.json` — the root lockfile already pins the exact
dependency set Atlas runs on, proven by Mizan's own deploy already installing
it), plus `atlas/backend/deploy-vps.sh` (a copy of Mizan's — already fully
generic, parametrized by `deploy.env`).

Health check after deploy:

```bash
curl -si https://atlas.100-26-109-162.sslip.io/api/health
```

## Demo data

`ATLAS_SEED_DEMO=true` seeds a fictional Egyptian developer's portfolio
(agents, projects, buildings, units, leads through signed contracts and
payment plans) and the sign-in form is pre-filled with the demo login
(`mostafa.halim@atlas.eg` / `demo-password-2026` — hardcoded in
`atlas/web/src/features/auth/login-page.tsx`, not an env var, unlike Mizan's
`VITE_DEMO_EMAIL`). For a real deployment: unset it and wipe the demo data.

## Rollback

Same as Mizan's (`docs/deployment.md` § Rollback) — the deploy ships build
output, not history; redeploy an older commit. Migrations are forward-only.
