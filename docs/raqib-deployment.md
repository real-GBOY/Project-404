# Raqib deployment

Raqib runs on **its own VPS** (Interserver KVM slice `vps3694926`, `root@162.35.28.116`, Ubuntu 24.04, x86_64, 1 vCPU, 1.6 GB RAM + 3 GB swap, about $3/month),
moved there on 2026-10-07 from the shared AWS box (`100.26.109.162`), which still hosts Mizan, Atlas and HotelOS and no longer serves Raqib.
It is an independent service: its own systemd unit, nginx server block, local Postgres 16 database and `.env`. The web app is on Vercel.

| Piece | Where |
|---|---|
| API | `https://raqib.162-35-28-116.sslip.io/api` (systemd `raqib`, `127.0.0.1:3300`, Node 24, heap capped at 300 MB) |
| Web app | `https://raqib-web.vercel.app` (Vercel project `raqib-web`, root directory `raqib/web`, git-connected to `main`) |
| Database | `raqib` on the box's own Postgres 16, restricted roles `auric_app` / `auric_system` (cluster-wide roles, row-level security); the migration owner is `postgres` over `127.0.0.1` |
| Files | Cloudflare R2 bucket `raqib-files` (Western Europe), presigned uploads straight from the browser |
| TLS | Let's Encrypt via certbot for the sslip.io host, renewed by the box's timer |

## Day to day

```bash
bash scripts/deploy-raqib-local.sh                # build the backend and ship it
SKIP_BUILD=1 bash scripts/deploy-raqib-local.sh   # ship the existing dist/
```

The script defaults to `root@162.35.28.116` and needs the SSH key `me` (repo root, gitignored) and ships `dist/` plus the shared `package.json` and lockfile, then runs
`/opt/raqib/deploy-vps.sh` on the box: install production dependencies only if the lockfile changed, restart the service, wait for
`/api/health`. Migrations run when the process boots. The **first boot of a demo database takes about three minutes** (it plays a
year of inspections through the real services), so the script's 60-second health gate may report a failure while the service is
still seeding: check `journalctl -u raqib` before assuming it is broken.

The web app deploys by itself on every push to `main` (Vercel). Its environment (Production and Preview): `VITE_API_BASE` (the API
URL above, **including the `/api` suffix**: the client's endpoints have no prefix) and `VITE_DEMO=true` (the demo accounts panel on the sign-in page).

## One-time setup (already done)

0. Fresh Ubuntu 24.04 as root: a 2 GB swap file (the first demo seed is memory-hungry), `nginx postgresql certbot python3-certbot-nginx`, Node 24 from
   NodeSource, a system user `auric` (home `/opt/raqib`, no shell), `ufw` allowing only 22, 80 and 443. Generated passwords live in `/root/.raqib-db-pass`,
   `/root/.raqib-app-pass` and `/root/.raqib-sys-pass` (root-only) and are written into `.env`.
1. `sudo -u postgres createdb raqib`, set a password for `postgres`, and create `auric_app` (NOBYPASSRLS) and `auric_system` (BYPASSRLS) with LOGIN and
   passwords before the first boot (the migration owner must be a superuser to alter them).
2. `/opt/raqib/.env`, mode 600, root-owned, never committed. Everything from `raqib/backend/.env.example` that matters:
   `NODE_ENV=production`, `AURIC_PORT=3300`, the three database URLs (owner for migrations, `auric_app` and `auric_system` at runtime),
   a **new** `AURIC_JWT_SECRET`, a **new** `RAQIB_DATA_KEY` (`openssl rand -base64 32`; back it up: losing it loses sealed national ids and
   two-step secrets), `AURIC_CORS_ORIGINS` (the Vercel origin and `*.vercel.app`), `AURIC_FILE_STORAGE_DRIVER=r2` with the four
   `AURIC_R2_*` values, `RAQIB_TRUSTED_PROXY_HOPS=1` (nginx is one proxy hop), and the three production switches from Core:
   `AURIC_SELF_SIGNUP=false` (accounts are issued, never self-registered; otherwise anyone could create a tenant and use presigned uploads),
   `AURIC_DOCS_ENABLED=false` (do not publish the API surface) and `AURIC_HOST=127.0.0.1` (only nginx can reach the process).
3. `/etc/systemd/system/raqib.service` (User `auric`, `EnvironmentFile=/opt/raqib/.env`, `NODE_OPTIONS=--max-old-space-size=300`,
   `Restart=on-failure`), then `systemctl enable raqib`.
4. nginx server block `raqib.162-35-28-116.sslip.io` proxying `/api/` to `127.0.0.1:3300` (and nothing at `/`: it redirects to the web app), then
   `sudo certbot --nginx -d raqib.162-35-28-116.sslip.io --redirect`.
5. R2: bucket `raqib-files` with a CORS rule for `https://*.vercel.app` (and the local dev ports): GET, PUT, HEAD, DELETE, any header,
   expose `ETag`. See [raqib/docs/operations.md](../raqib/docs/operations.md).
6. Backups: `/etc/cron.d/raqib-backup` runs `/opt/raqib/raqib-backup.sh` at 02:30 UTC (see below).
7. Vercel: project `raqib-web`, framework Vite, root directory `raqib/web`, repository `real-GBOY/Project-404`, the two variables above.

## Demo mode on this deployment

The live site is a **showcase**: it runs with `RAQIB_SEED_DEMO=true` and the explicit opt-in `RAQIB_ALLOW_DEMO_IN_PRODUCTION=true`,
because Raqib refuses to seed the demo company in production on its own (so it can never appear next to real data). It also sets
`RAQIB_ENFORCE_ACCOUNT_POLICY=false` so the demo accounts can sign in without enrolling two-step verification. To turn it into a real
deployment: set the first two to `false`, set `RAQIB_ENFORCE_ACCOUNT_POLICY=true`, use a fresh database, provision the customer with
`npm run provision` (see [raqib/docs/operations.md](../raqib/docs/operations.md)), and drop `VITE_DEMO` from Vercel.

### Keeping the demo current without resetting it

A reset (new empty database, three-minute seed) erases whatever has been entered on the demo. To bring the existing demo up to date instead, run
the upgrade routine **on the box**, with the live environment, from a copy of the current build:

```bash
cd /opt/raqib   # or a scratch directory holding the new dist/ with node_modules linked to /opt/raqib/node_modules
set -a; . /opt/raqib/.env; set +a; export RAQIB_SEED_DEMO=false
node dist/raqib/backend/scripts/demo-upgrade.js           # adds what is missing, then checks consistency
node dist/raqib/backend/scripts/demo-upgrade.js --check   # only checks
```

It adds only what is missing (a clearly labelled placeholder deduction table and its scoring manager, shift hours, contract dates and head-counts,
the surveys, the guards' own training requests), never re-scores issued work, is safe to run twice, and lists anything that is not part of the demo
(for example leftovers from a test run). Take a backup first (`sudo bash /opt/raqib/raqib-backup.sh`); it was last run this way on 2026-10-09 after a
dry run on a copy of the database.

`RAQIB_DEMO_SAMPLE_VALUES=true` in the box's `.env` would make a **fresh** demo seed with those placeholder values; the upgrade routine is for the
database that already exists.

## Backups

`scripts/raqib-backup.sh` runs nightly at 02:30 UTC from `/etc/cron.d/raqib-backup` (installed by hand once; the deploy script keeps the script and
`offsite-backup.mjs` up to date in `/opt/raqib`). It writes a `pg_dump -Fc` to `/var/backups/raqib` (newest 14 kept, each checked by reading it back)
and copies it into R2 under `backups/` in `raqib-files` (newest 14 days kept), so losing the server does not lose the data. Output goes to
`/var/log/raqib-backup.log`. Take one by hand with `sudo bash /opt/raqib/raqib-backup.sh`.

Restore (the service is stopped meanwhile, the restore rebuilds the database exactly as it was):

```bash
sudo systemctl stop raqib
sudo -u postgres dropdb raqib && sudo -u postgres createdb raqib
sudo pg_restore -d raqib --no-owner -U postgres /var/backups/raqib/raqib-YYYY-MM-DD.dump   # or a dump fetched from R2 backups/
sudo systemctl start raqib
```

Uploaded files are not part of the dump: they live in R2, and a restore of an older dump simply leaves newer objects unreferenced (the nightly cleanup
removes unattached uploads). `RAQIB_DATA_KEY` must be the same key the dump's sealed values were written with, so back it up separately from the dumps.

## Web security headers

`raqib/web/vercel.json` sends a Content-Security-Policy (scripts only from the app itself; connections only to the app, the API host and R2; fonts
from Google Fonts), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a locked-down Permissions-Policy. **If the API URL or the storage
host ever changes, update `connect-src` there**, or the app will stop reaching it. To try a policy before shipping it, run the browser tests with
`E2E_CSP="<policy>"`: it is sent with every page, so any violation fails a test.

## Testing the live site

For the live demo use the **read-only smoke test**, which signs in as each role, opens the main screens and checks the key figures but writes
nothing:

```bash
cd raqib/web
E2E_WEB=https://raqib-web.vercel.app E2E_API=https://raqib.162-35-28-116.sslip.io npx playwright test e2e/90-live-smoke.spec.ts
```

The rest of the browser suite **creates data** (projects, forms, accounts, visits). Running it against the showcase leaves test records behind: an earlier
run left an "E2E Project" in the live ranking. Do not run it there; if you ever must, take a backup first. **Never run `09-auth`** against a live server: it
locks accounts and changes passwords. The confidential-report workflow is rate limited on purpose (5 submissions and 20 entries per person per hour).

## Report PDFs

The server renders no PDFs. `GET /raqib/reports/:id/html?lang=ar|en` returns the report as one print-ready page built from the frozen snapshot
(authorized by scope and the download right, audited), and the web app prints it in the browser ("Save as PDF"). So the box needs no Chromium and there
is no rendering service, token or quota to manage.

## Not on this deployment

- **Outgoing e-mail.** No SMTP is configured, so password-setup links are not mailed.
- **Antivirus scanning** (ClamAV) is off; uploads are still content-checked and stripped of GPS metadata.
