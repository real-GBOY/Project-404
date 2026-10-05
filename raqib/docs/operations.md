# Raqib — operations

Raqib is a separate AURIC deployment: its own process (port 3300), its own PostgreSQL database `raqib`, its own JWT
secret. Nothing is shared with Mizan, Atlas or HotelOS except Core's source.

## Environment

All variables are listed in `backend/.env.example`. The ones that matter in production:

| Variable | Notes |
|---|---|
| `NODE_ENV=production` | enables production checks (CORS, secrets) |
| `AURIC_DATABASE_URL` | the schema owner — used **only** by `npm run migrate` |
| `AURIC_APP_DATABASE_URL` / `AURIC_SYSTEM_DATABASE_URL` | the runtime roles. **Both must be set**: with them unset the app falls back to the owner role and row-level security is not enforced |
| `AURIC_JWT_SECRET` | long random value, never shared with another product |
| `AURIC_APP_URL` | public URL of the web app (password-setup links) |
| `AURIC_CORS_ORIGINS` | the web app origin(s), e.g. `https://raqib.example.com` |
| `AURIC_FILE_STORAGE_DRIVER=r2` + the R2 keys | evidence and attachments in Cloudflare R2. `local` writes under `AURIC_FILE_STORAGE_PATH` and is for a single small server |
| `RAQIB_CHROMIUM_PATH` | Chromium/Chrome binary used to render report PDFs, e.g. `/usr/bin/chromium`. Empty = PDF download answers `raqib.pdf_unavailable` (everything else works) |
| `RAQIB_TRUSTED_PROXY_HOPS=1` | behind nginx. The rate limiter reads the client address that many hops from the right of `X-Forwarded-For`; with `0` behind a proxy every visitor shares one address |
| `RAQIB_SEED_DEMO=false` | **never** `true` against real data |

Chromium on the VPS: `sudo apt-get install -y chromium` (or `chromium-browser`) and point `RAQIB_CHROMIUM_PATH` at it.
It is started per render, headless, with JavaScript disabled and no network needed.

## Build and run

```bash
cd raqib/backend
npm ci
npm run build          # SWC → dist/
npm run migrate        # applies prisma/migrations with the owner role
node dist/raqib/backend/main.js   # or the systemd unit below
```

The first boot seeds the Raqib role templates and the platform roles (`AppSeedService`). The first organization and its
owner are created by your provisioning step, not by the app.

### systemd

```ini
[Unit]
Description=Raqib API
After=network.target postgresql.service

[Service]
User=raqib
WorkingDirectory=/opt/raqib/backend
EnvironmentFile=/opt/raqib/.env
ExecStart=/usr/bin/node dist/raqib/backend/main.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

### nginx

```nginx
server {
  server_name raqib-api.example.com;
  client_max_body_size 520m;          # evidence videos go straight to storage; local driver passes through here
  location / {
    proxy_pass http://127.0.0.1:3300;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;          # PDF rendering
  }
}
```

The web app (`raqib/web`) is a static build (`npm run build`) served from any static host with `VITE_API_BASE` set to
the API origin at build time.

## Database roles and RLS

Migrations create the tables; the runtime connects as `auric_app` (tenant-scoped, subject to RLS) and, for workers and
sign-up, `auric_system`. Every Raqib table has `FORCE ROW LEVEL SECURITY` with a `tenant_isolation` policy; the
confidential tables add a restrictive policy that requires the application to authorize the transaction
(`app.conf_access`). Verify after provisioning:

```sql
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname LIKE 'raqib_%' AND relkind = 'r';
-- every row must be (true, true)
```

## Backup and restore

What must be backed up: the PostgreSQL database `raqib` and the file storage (R2 bucket, or `AURIC_FILE_STORAGE_PATH`).
The two are consistent only as a pair: files are referenced from `files`, `raqib_evidence` and `raqib_conf_files`.

```bash
# nightly, off-box copy, keep 14 daily + 8 weekly
pg_dump --format=custom --no-owner --file=/backup/raqib-$(date +%F).dump "$AURIC_DATABASE_URL"
# R2: enable bucket versioning, or rclone sync the bucket to a second location
```

Restore into a **new** database, never over the live one:

```bash
createdb raqib_restore
pg_restore --no-owner --role=postgres --dbname=raqib_restore /backup/raqib-YYYY-MM-DD.dump
# create/grant the auric_app and auric_system roles on it, point AURIC_*_DATABASE_URL at it, start the API
npm run migrate:status   # must report "up to date"
```

Then check: sign in, open an approved report and download its PDF, open evidence, and (as the General Manager) confirm
the confidential grants list loads. Test a restore at least once per quarter; an untested backup is a hope.

Issued reports are frozen snapshots in the database, so a restore reproduces them exactly; only the PDF bytes are
re-rendered on demand.

## Routine operations

- **Logs** are JSON on stdout (journald). A request carries a correlation id that is also stored on audit rows.
- **Health**: `GET /api/health`.
- **Scheduled jobs** (overdue visits and corrective actions) run inside the API every `RAQIB_JOBS_INTERVAL_MS`
  (default 15 minutes); they are idempotent and announce each overdue item once.
- **Rotating the JWT secret** signs everyone out; do it after any suspected leak.
- **Grants** to the confidential area expire on their own; review them from the General Manager's grants screen.
