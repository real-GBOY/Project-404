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
| `RAQIB_SEED_DEMO=false` | **never** `true` against real data (the process refuses to start with it in production) |
| `RAQIB_DATA_KEY` | **required in production**: 32 random bytes, base64 (`openssl rand -base64 32`). Seals national IDs and second-factor secrets; back it up with the database password, because without it those values are unrecoverable |
| `RAQIB_ENFORCE_ACCOUNT_POLICY` | defaults to on in production: people owing a second factor or a new password are held at account set-up |
| `RAQIB_METRICS_TOKEN` | bearer token for `GET /api/metrics`; unset = 404 |
| `RAQIB_ALERT_WEBHOOK_URL` | Slack/Teams/PagerDuty-style webhook for server errors and failed jobs |
| `RAQIB_CLAMAV_HOST` / `_PORT` | optional antivirus daemon for uploads |
| `RAQIB_PDF_CONCURRENCY` / `_QUEUE_MAX` / `_TIMEOUT_MS` | bounds on PDF rendering (defaults 2 / 20 / 45 s) |

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

## Provisioning a customer

```bash
cd raqib/backend
npm run provision -- --name "Acme Security" --slug acme --owner-email ceo@acme.example --owner-name "Sara Ali"
# optional: --name-ar, --owner-name-ar, --city, --owner-role gm, --no-starter-forms, --migrate
```

Creates the organization, its first administrator (quality manager by default), default settings and the starter forms, and prints
a single-use link (valid 7 days) for the owner to choose a password. It refuses an existing slug or e-mail. The public account-request
page for the company is `/request-account/<slug>`; further people join through account requests the owner approves.

## Monitoring

- `GET /api/health` (liveness), `GET /api/health/ready` (Core: database, outbox), `GET /api/health/raqib` (jobs running on time,
  storage writable, PDF queue). A hard failure answers 503.
- `GET /api/metrics` (Prometheus, token-protected): request counts and latency, process memory, last job run, PDF queue, outbox
  backlog and dead letters. Alert on `raqib_jobs_last_run_timestamp_seconds` going stale and on `raqib_outbox_dead_lettered > 0`.
- Server errors and failed jobs are posted to `RAQIB_ALERT_WEBHOOK_URL` (de-duplicated, at most 30 an hour).
- Retention runs with the scheduled jobs: decided account requests are erased after `RAQIB_ACCOUNT_REQUEST_RETENTION_DAYS`; evidence
  older than the organization's attachment retention (settings, years; 0 = keep) is deleted from storage and flagged purged.
- `GET /api/raqib/account/users/:id/personal-data` (users export right) produces a person's data for a data-subject request.

## Browser tests

`cd raqib/web && npm run e2e` builds the app, starts the backend on a throw-away database (`raqib_e2e`, seeded with the demo
organization) and drives real Chrome through every role's screens, offline work, sign-in and account security. CI runs it on every
change.

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

## File storage (Cloudflare R2) and PDFs

Evidence photos, videos, PDFs and confidential attachments use the presigned-upload flow: the browser asks the API for a URL
(`POST /files/uploads`), PUTs the bytes straight to storage, then confirms (`POST /files/:id/confirm`); the API only
touches the bytes afterwards (content sniffing, image sanitising, optional ClamAV). With `AURIC_FILE_STORAGE_DRIVER=r2` the URL
points at `https://<account>.r2.cloudflarestorage.com/<bucket>/...`. Raqib has its own bucket, `raqib-files` (Western Europe), next to Mizan's `mizan-files`. Keys are `<organization>/<yyyy>/<mm>/<file>`. Products can
also share one bucket: set `AURIC_R2_KEY_PREFIX` (for example `raqib`) to give each its own folder. Changing the bucket or prefix later orphans
existing objects: copy them first. Set `AURIC_R2_ACCOUNT_ID`, `AURIC_R2_BUCKET`, `AURIC_R2_ACCESS_KEY_ID`, `AURIC_R2_SECRET_ACCESS_KEY`.

The bucket needs a CORS rule for every web origin that uploads (GET, PUT, HEAD, DELETE; headers `*`; expose `ETag`). Add the
production web origin there before deploying; local dev uses `http://localhost:4500` (and `:4599` for the e2e preview). `raqib-files` already allows `*.vercel.app` and those two.

Report PDFs are rendered by a Chromium on the server: set `RAQIB_CHROMIUM_PATH`. Without it the PDF button says rendering is
unavailable. Analytics and audit exports (CSV and Excel) need nothing extra.

Uploads nobody attached are cleaned up by the nightly job: a file (or a started upload) older than 48 hours that is not referenced by
evidence, a confidential attachment or a message is deleted from the database and from R2 (audited as `raqib.retention.uploads_purged`).
