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
   `AURIC_R2_*` values, and `RAQIB_TRUSTED_PROXY_HOPS=1` (nginx is one proxy hop).
3. `/etc/systemd/system/raqib.service` (User `auric`, `EnvironmentFile=/opt/raqib/.env`, `NODE_OPTIONS=--max-old-space-size=300`,
   `Restart=on-failure`), then `systemctl enable raqib`.
4. nginx server block `raqib.100-26-109-162.sslip.io` proxying `/api/` to `127.0.0.1:3300`, then
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

## Not on this deployment

- **Report PDFs.** They need a headless Chromium (`RAQIB_CHROMIUM_PATH`), and Ubuntu 20.04 on ARM only offers a snap-packaged one that is
  too heavy for this box. The PDF button reports that rendering is unavailable; CSV and Excel exports work.
- **Outgoing e-mail.** No SMTP is configured, so password-setup links are not mailed.
- **Antivirus scanning** (ClamAV) is off; uploads are still content-checked and stripped of GPS metadata.
