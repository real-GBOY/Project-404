# How we deploy a backend built on AURIC Core

## The idea

Every product backend (Mizan, Atlas, HotelOS) is its own NestJS/Fastify app that imports `core/` (kernel, identity, orgs, RBAC, messaging, assistant, files). Each one deploys as an independent service on one shared AWS ARM VPS (`ubuntu@100.26.109.162`, t4g, 921 MB RAM + 2 GB swap, Ubuntu 20.04). There is no Docker because the box is too small.

**Raqib** follows the same recipe but runs on its **own VPS** (Interserver, `root@162.35.28.116`), with its own Postgres 16, nginx and certificate: see [raqib-deployment.md](raqib-deployment.md). **Admit** (backend on `:3400`, database `admit`, plus a Python email worker) is deployed on that same Interserver VPS as its own systemd service, user, directory and database: see [admit-deployment.md](admit-deployment.md).

Each product gets its own:

| | Mizan | Atlas | HotelOS |
|---|---|---|---|
| systemd service | `mizan` | `atlas` | `hotelos` |
| Port | 3000 | 3100 | 3200 |
| Dir | `/opt/mizan` | `/opt/atlas` | `/opt/hotelos` |
| Postgres DB | `auric` | `atlas` | its own |
| Hostname | `100-26-109-162.sslip.io` | `atlas.100-26-109-162.sslip.io` | `hotel.100-26-109-162.sslip.io` |
| Deploy script | `scripts/deploy-local.sh` | `scripts/deploy-atlas-local.sh` | `scripts/deploy-hotel-local.sh` |

The products share nothing at runtime: no process, port, database, `.env` or JWT secret. Their only link is that they're built on Core. The `auric_app` and `auric_system` Postgres roles are cluster-wide, but each product's RLS migration grants them rights only inside its own database.

## Stack on the box

- **nginx** terminates TLS (Let's Encrypt via certbot on sslip.io hostnames, so no domain purchase). It proxies `/api/` to the Node process, `/socket.io/` as a WebSocket upgrade, and serves any bundled SPA from `/var/www/<product>`.
- **Node 24 arm64** runs as the `auric` user under systemd.
- **PostgreSQL 12** (stock Ubuntu build).

## Build locally, ship artifacts

The VPS is too small to compile, so builds happen on the dev machine.

1. `npm ci`, then `npm run build` in the product backend. `scripts/build.mjs` compiles with SWC and stages Prisma inside `dist/<product>/backend/`. The entrypoint is `dist/main.js` for Mizan and `dist/<product>/backend/main.js` for the others.
2. The script tars `dist/` and streams it with `tar -czf - | ssh 'cat > /tmp/x.tgz'`. The box has no rsync, and scp of many small files crawls.
3. It also copies the root `package.json` and `package-lock.json`, `deploy-vps.sh`, and a tiny `deploy.env` (`SERVICE=`, `PORT=`). Products built on Core ship no `package.json` of their own, because the root lockfile already pins the exact dependency set they run on.
4. On the box, over ssh with passwordless sudo, it empties `dist/` with `find -mindepth 1 -delete` and extracts the new build. Then it runs `deploy-vps.sh`.

## `deploy-vps.sh` (runs as root on the box)

It's generic, driven by `SERVICE`, `PORT` and `BACKEND_DIR`. The three copies are kept identical by hand.

- Runs `npm ci --omit=dev` only if the lockfile hash changed since the last deploy (a stamp file). This matters because `npm ci` wipes `node_modules` on a tiny box.
- argon2 and the Prisma engines have native install scripts that npm 11 skips by default. The script passes `--foreground-scripts --unsafe-perm`, runs `npm rebuild`, then verifies `require('argon2')` and fails loudly if it doesn't load.
- Runs `systemctl restart <service>`.
- Polls `http://127.0.0.1:<port>/api/health` for up to about 60 seconds. If that fails, it dumps `systemctl status` and `journalctl` and exits 1.

## Migrations

Prisma owns the schema and migrations. There is no Prisma Client at runtime, only generated Kysely types. The app runs `migrateToLatest` on boot, so the restart is the whole cutover. Migrations are forward-only, so there are no down-migrations.

## Secrets and config

Everything lives only in `/opt/<product>/.env` (mode 600, never committed, never touched by the deploy):

- `AURIC_APP_DATABASE_URL` and `AURIC_SYSTEM_DATABASE_URL` (the RLS-enforced roles)
- `AURIC_JWT_SECRET`, unique per product so a token from one never validates on another
- `AURIC_CORS_ORIGINS` when the frontend is on another origin, such as Vercel (a `*.host` entry becomes a suffix match). The socket uses the same allow-list.
- Optional `GROQ_API_KEY` for the AI Copilot. If it's unset, the endpoint is disabled rather than crashing boot.
- Demo seed flags (`MIZAN_SEED_DEMO`, `ATLAS_SEED_DEMO`). Turn these off and wipe the demo data before real use.

## Frontends

Mizan web and the HotelOS app and site are on Vercel, with GitHub auto-deploy from `main`. They call the VPS API cross-origin through `VITE_API_BASE`. Atlas web is served by nginx from the same host and calls `/api` same-origin, so it needs no CORS.

## Adding a new product on Core (one-time box setup)

1. `createdb <product>`, run its migrations once as the schema owner, then provision the `auric_app` and `auric_system` roles with `npm run provision-db`.
2. Write `/opt/<product>/.env` with a fresh JWT secret and a new `AURIC_PORT`.
3. Add a systemd unit like `atlas.service`: `User=auric`, `EnvironmentFile`, `ExecStart=node dist/.../main.js`, `Restart=on-failure`.
4. Add an nginx server block for a new sslip hostname, with `/api/`, `/socket.io/` (upgrade headers, long timeouts) and the SPA fallback, then run `certbot --nginx -d <host>`.
5. Copy the deploy script and pass the new `SERVICE`, `PORT` and `BACKEND_DIR`. After that, `bash scripts/deploy-<x>-local.sh` handles every release.

## Gotchas

- Realtime messaging uses Socket.IO's in-memory adapter, so run only one API process per product. Scaling out needs a shared adapter first (`docs/messaging.md` §9).
- Check `free -h` and `df -h` before adding a service, since each Node process is a real cost on 921 MB.
- The box is shared with an unrelated project ("dawava"). Never use `13.220.157.42`, which is not ours.
- CI deploy jobs exist, but CI is switched off and the secrets aren't set. Deploys are manual.
- Rollback means redeploying an older commit, because the deploy ships build output, not history.
- The SSH key is `me` at the repo root. It should be gitignored or moved.

## See also

`docs/deployment.md` (Mizan), `docs/atlas-deployment.md`, and the HotelOS deployment doc.
