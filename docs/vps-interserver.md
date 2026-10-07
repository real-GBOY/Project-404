# The production VPS (Interserver)

Since 2026-10-07 **all four AURIC products run on one Interserver KVM slice**, `vps3694926`, `root@162.35.28.116` (Ubuntu 24.04, x86_64, 1 vCPU,
1.6 GB RAM + 3 GB swap, about $3/month). The earlier AWS box (`ubuntu@100.26.109.162`) is retired; the per-product docs
([deployment.md](deployment.md) for Mizan, [atlas-deployment.md](atlas-deployment.md), [raqib-deployment.md](raqib-deployment.md)) still describe each
product's configuration, but **hostnames, SSH user and Postgres version are the ones below**.

| Product | API host (TLS via Let's Encrypt) | Port | systemd | Database | Frontend |
|---|---|---|---|---|---|
| Mizan | `https://162-35-28-116.sslip.io/api` | 3000 | `mizan` | `mizan` | Vercel `mizan-web` (`mizan-web-seven.vercel.app`) |
| Atlas | `https://atlas.162-35-28-116.sslip.io/api` | 3100 | `atlas` | `atlas` | served by nginx from `/var/www/atlas` at the same host, and Vercel `atlas-web` |
| HotelOS | `https://hotel.162-35-28-116.sslip.io/api` | 3200 | `hotelos` | `hotelos` | Vercel `hotel-nayel` (public site + booking); the staff app has no deployment yet |
| Raqib | `https://raqib.162-35-28-116.sslip.io/api` | 3300 | `raqib` | `raqib` | Vercel `raqib-web` |

Each product has `/opt/<name>/` (`dist/`, `.env` mode 600, `deploy.env`, `deploy-vps.sh`), its own nginx server block and its own `.env`. `node_modules`
is shared: `/opt/mizan`, `/opt/atlas` and `/opt/hotelos` symlink to `/opt/raqib/node_modules` (all four use the one root lockfile), which is what keeps
this box small. Heaps are capped at 220 MB per service (Raqib 300 MB). Postgres 16 is local; `postgres` owns migrations and the shared roles `auric_app` /
`auric_system` serve requests under row-level security. The generated passwords are in `/root/.raqib-{db,app,sys}-pass` (root only).

Mizan, Atlas and HotelOS run their demo seeders (`MIZAN_SEED_DEMO`, `ATLAS_SEED_DEMO`, `HOTEL_SEED_DEMO`) as before. Mizan reuses the R2 bucket
`mizan-files` and the Groq key from the local root `.env`; Atlas takes its Groq key from `atlas/backend/.env`; Atlas and HotelOS keep files on local disk
(`/opt/<name>/storage`).

## Deploying

```bash
bash scripts/deploy-local.sh          # Mizan (also ships mizan/web to /var/www/mizan, which nginx does not serve: the web app is on Vercel)
bash scripts/deploy-atlas-local.sh    # Atlas backend + web
bash scripts/deploy-hotel-local.sh    # HotelOS backend
bash scripts/deploy-raqib-local.sh    # Raqib backend
```

All default to `root@162.35.28.116` with the key `me` (repo root, gitignored). The Vercel apps deploy by themselves from `main`. Their API URLs are the
`VITE_API_BASE` variable (`VITE_HOTEL_API` too for `hotel-nayel`), **ending in `/api`**; changing one needs a redeploy (`vercel redeploy <url>`), and
Raqib additionally needs the host in `raqib/web/vercel.json` (`connect-src`). A first boot on a fresh database seeds the demo and takes a few minutes,
so the deploy script's health gate may time out: check `journalctl -u <name>`.

## Backups

Raqib: `/etc/cron.d/raqib-backup`, 02:30 UTC, `pg_dump` kept 14 days locally plus a copy in R2 (see [raqib-deployment.md](raqib-deployment.md)).
Mizan, Atlas, HotelOS: `/etc/cron.d/auric-dbbackup` runs `/opt/auric-dbbackup.sh` at 02:45 UTC into `/var/backups/auric`, 7 days kept, **on the same
disk only** (no off-box copy). Restore as in the Raqib doc (`pg_restore -d <db> --no-owner`).

## Day to day

```bash
ssh -i me root@162.35.28.116
systemctl is-active mizan atlas hotelos raqib nginx postgresql
journalctl -u <name> -n 50 --no-pager
free -m          # about 700 MB should stay available; if swap grows, upgrade the slice (my.interserver.net -> Upgrade VPS Slices)
```
