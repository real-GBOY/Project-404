# Raqib deployment

Raqib runs on the **same VPS as the other products** (`ubuntu@100.26.109.162`, ARM64, 921 MB RAM + 2 GB swap), as an independent
service: its own systemd unit, nginx server block, Postgres database and `.env`. The web app is on Vercel. Nothing here touches
Mizan, Atlas or HotelOS.

| Piece | Where |
|---|---|
| API | `https://raqib.100-26-109-162.sslip.io/api` (systemd `raqib`, `127.0.0.1:3300`, Node 24, heap capped at 300 MB) |
| Web app | `https://raqib-web.vercel.app` (Vercel project `raqib-web`, root directory `raqib/web`, git-connected to `main`) |
| Database | `raqib` on the box's Postgres 12, restricted roles `auric_app` / `auric_system` (shared cluster-wide roles, row-level security) |
| Files | Cloudflare R2 bucket `raqib-files` (Western Europe), presigned uploads straight from the browser |
| TLS | Let's Encrypt via certbot for the sslip.io host, renewed by the box's timer |

## Day to day

```bash
bash scripts/deploy-raqib-local.sh                # build the backend and ship it
SKIP_BUILD=1 bash scripts/deploy-raqib-local.sh   # ship the existing dist/
```

The script needs the SSH key `me` (repo root, gitignored) and ships `dist/` plus the shared `package.json` and lockfile, then runs
`/opt/raqib/deploy-vps.sh` on the box: install production dependencies only if the lockfile changed, restart the service, wait for
`/api/health`. Migrations run when the process boots. The **first boot of a demo database takes about three minutes** (it plays a
year of inspections through the real services), so the script's 60-second health gate may report a failure while the service is
still seeding: check `journalctl -u raqib` before assuming it is broken.

The web app deploys by itself on every push to `main` (Vercel). Its environment (Production and Preview): `VITE_API_BASE` (the API
URL above) and `VITE_DEMO=true` (the demo accounts panel on the sign-in page).

## One-time setup (already done)

1. `sudo -u postgres createdb raqib`.
2. `/opt/raqib/.env`, mode 600, root-owned, never committed. Everything from `raqib/backend/.env.example` that matters:
   `NODE_ENV=production`, `AURIC_PORT=3300`, the three database URLs (owner for migrations, `auric_app` and `auric_system` at runtime),
   a **new** `AURIC_JWT_SECRET`, a **new** `RAQIB_DATA_KEY` (`openssl rand -base64 32`; back it up: losing it loses sealed national ids and
   two-step secrets), `AURIC_CORS_ORIGINS` (the Vercel origin and `*.vercel.app`), `AURIC_FILE_STORAGE_DRIVER=r2` with the four
   `AURIC_R2_*` values, `RAQIB_TRUSTED_PROXY_HOPS=1` (nginx is one proxy hop), and the three production switches from Core:
   `AURIC_SELF_SIGNUP=false` (accounts are issued, never self-registered; otherwise anyone could create a tenant and use presigned uploads),
   `AURIC_DOCS_ENABLED=false` (do not publish the API surface) and `AURIC_HOST=127.0.0.1` (only nginx can reach the process).
3. `/etc/systemd/system/raqib.service` (User `auric`, `EnvironmentFile=/opt/raqib/.env`, `NODE_OPTIONS=--max-old-space-size=300`,
   `Restart=on-failure`), then `systemctl enable raqib`.
4. nginx server block `raqib.100-26-109-162.sslip.io` proxying `/api/` to `127.0.0.1:3300` (and nothing at `/`: it redirects to the web app), then
   `sudo certbot --nginx -d raqib.100-26-109-162.sslip.io --redirect`.
5. R2: bucket `raqib-files` with a CORS rule for `https://*.vercel.app` (and the local dev ports): GET, PUT, HEAD, DELETE, any header,
   expose `ETag`. See [raqib/docs/operations.md](../raqib/docs/operations.md).
6. Vercel: project `raqib-web`, framework Vite, root directory `raqib/web`, repository `real-GBOY/Project-404`, the two variables above.

## Demo mode on this deployment

The live site is a **showcase**: it runs with `RAQIB_SEED_DEMO=true` and the explicit opt-in `RAQIB_ALLOW_DEMO_IN_PRODUCTION=true`,
because Raqib refuses to seed the demo company in production on its own (so it can never appear next to real data). It also sets
`RAQIB_ENFORCE_ACCOUNT_POLICY=false` so the demo accounts can sign in without enrolling two-step verification. To turn it into a real
deployment: set the first two to `false`, set `RAQIB_ENFORCE_ACCOUNT_POLICY=true`, use a fresh database, provision the customer with
`npm run provision` (see [raqib/docs/operations.md](../raqib/docs/operations.md)), and drop `VITE_DEMO` from Vercel.

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

The browser suite can run against production: `E2E_WEB=https://raqib-web.vercel.app E2E_API=https://raqib.100-26-109-162.sslip.io npx playwright test`
with the specs that are safe on shared demo data (`01` to `08`). **Never run `09-auth`** there: it locks accounts and changes
passwords. The create-data specs leave test records behind; take a backup first and restore it afterwards if you want the demo exactly as seeded.

## Report PDFs

The server renders no PDFs. `GET /raqib/reports/:id/html?lang=ar|en` returns the report as one print-ready page built from the frozen snapshot
(authorized by scope and the download right, audited), and the web app prints it in the browser ("Save as PDF"). So the box needs no Chromium and there
is no rendering service, token or quota to manage.

## Not on this deployment

- **Outgoing e-mail.** No SMTP is configured, so password-setup links are not mailed.
- **Antivirus scanning** (ClamAV) is off; uploads are still content-checked and stripped of GPS metadata.
