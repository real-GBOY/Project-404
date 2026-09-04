# Deployment

Mizan runs as a single Node process on one small VPS — bare **systemd + nginx +
Postgres**, no Docker. `nginx` serves the web bundle statically and reverse-proxies
`/api` to the Node process. Secrets live only in `$VPS_BACKEND_DIR/.env` on the box.

**Current box:** `http://13.220.157.42` — AWS EC2 `t4g` (ARM64), Ubuntu 20.04,
921 MB RAM + 2 GB swap. SSH `ubuntu@13.220.157.42`. Service `mizan.service` runs
as `User=auric`, `WorkingDirectory=/opt/mizan`, `ExecStart=… node dist/main.js`.
nginx serves `/var/www/mizan`, proxies `/api` → `127.0.0.1:3000`. Postgres 12,
DB `auric`, localhost only, RLS roles `auric_app` / `auric_system`.

## Continuous deployment

Every push to `main` that passes CI is deployed automatically by the `deploy` job
in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

```
push to main
  └─ backend job  (typecheck · lint · format · test · build)  ─┐
  └─ web job      (lint · typecheck · test · build)            ─┤ both must pass
                                                                │
  └─ deploy job                                                 ◄┘
       1. build backend  → dist/           (tsc; Prisma staged inside dist/)
       2. build web       → mizan/web/dist/ (vite; VITE_DEMO_* baked in)
       3. rsync (via `sudo rsync` on the box, --delete on build output):
            dist/            → $VPS_BACKEND_DIR/dist/
            package*.json    → $VPS_BACKEND_DIR/
            deploy-vps.sh    → $VPS_BACKEND_DIR/
            mizan/web/dist/  → $VPS_WEB_ROOT/
       4. ssh vps  →  sudo … scripts/deploy-vps.sh
            · npm ci --omit=dev   (only when package-lock.json changed; runs the
              native install scripts for argon2 / Prisma and verifies argon2 loads)
            · systemctl restart $VPS_SERVICE
              (pending migrations apply on boot — main.ts → migrateToLatest)
            · poll http://127.0.0.1:$VPS_PORT/api/health until 200 (fails the
              run and prints service logs if it never goes healthy)
```

The box compiles nothing. `concurrency: deploy-vps` serialises deploys so two
merges in quick succession can't race.

## One-time setup

### 1. A dedicated deploy key

Do **not** reuse a personal key (the old `me` key in the repo root is one — stop
using it and delete it). On any machine:

```bash
ssh-keygen -t ed25519 -N '' -C 'mizan-ci-deploy' -f mizan_deploy
# add the public half to the deploy user on the box:
ssh ubuntu@13.220.157.42 'cat >> ~/.ssh/authorized_keys' < mizan_deploy.pub
ssh-keyscan -H 13.220.157.42        # → value for VPS_SSH_KNOWN_HOSTS
```

### 2. Repo secrets — Settings → Secrets and variables → Actions → *Secrets*

| Secret | Required | Value |
|---|---|---|
| `VPS_SSH_KEY` | yes | full contents of the private key (`mizan_deploy`) |
| `VPS_HOST` | yes | `13.220.157.42` |
| `VPS_USER` | yes | `ubuntu` |
| `VPS_SSH_KNOWN_HOSTS` | recommended | `ssh-keyscan -H 13.220.157.42` output. If unset, CI trusts the host on first contact (TOFU) with a warning. |
| `VITE_DEMO_PASSWORD` | optional | pre-fills the login form on the deployed site (demo instances only) |

### 3. Repo variables — same page → *Variables* (all optional; defaults match the current box)

| Variable | Default | Notes |
|---|---|---|
| `VPS_BACKEND_DIR` | `/opt/mizan` | holds `dist/`, `node_modules/`, `.env`, `package*.json` |
| `VPS_WEB_ROOT` | `/var/www/mizan` | nginx `root` for the SPA |
| `VPS_SERVICE` | `mizan` | systemd unit (`mizan.service`) |
| `VPS_PORT` | `3000` | `AURIC_PORT` the service listens on |
| `VITE_DEMO_EMAIL` | — | pairs with `VITE_DEMO_PASSWORD` |

### 4. On the VPS — let the deploy user drive rsync + the release as root

The login user (`ubuntu`) differs from the service user (`auric`), so the deploy
runs the remote `rsync` and `deploy-vps.sh` through `sudo`:

```
# /etc/sudoers.d/mizan-deploy   (visudo -f, mode 0440)
ubuntu ALL=(root) NOPASSWD: /usr/bin/rsync, /bin/bash /opt/mizan/deploy-vps.sh
```

`deploy-vps.sh` runs `npm`, `systemctl restart mizan`, `systemctl status`,
`journalctl -u mizan` and `curl` — all as root once bash is invoked, so no
further entries are needed. `SERVICE` / `PORT` reach the script through
`/opt/mizan/deploy.env` (written by CI), not the sudo command line, so the rule
above can stay exact. If you change `VPS_BACKEND_DIR`, update the path in the
rule to match.

Also ensure:

- **Node** ≥ 22.12 (box has 24.20 in `/usr/local`) on root's `PATH`.
- `$VPS_BACKEND_DIR/.env` exists (mode 600) with real config — never committed,
  never touched by the deploy.
- This npm (11.x) skips dependency install scripts unless allow-listed. The
  script passes `--foreground-scripts --unsafe-perm` and then `npm rebuild`s
  `argon2` / `prisma` / `@prisma/engines`; if a fresh box still won't build them,
  run once by hand in `$VPS_BACKEND_DIR`:
  ```
  npm ci --omit=dev --foreground-scripts --unsafe-perm
  npm rebuild argon2 prisma @prisma/engines
  ```

## Manual deploy

```bash
npm ci && npm run build
cd mizan/web && npm ci && npm run build && cd ../..
rsync -az --delete --rsync-path="sudo rsync" dist/ ubuntu@13.220.157.42:/opt/mizan/dist/
rsync -az --rsync-path="sudo rsync" package.json package-lock.json scripts/deploy-vps.sh ubuntu@13.220.157.42:/opt/mizan/
rsync -az --delete --rsync-path="sudo rsync" mizan/web/dist/ ubuntu@13.220.157.42:/var/www/mizan/
ssh ubuntu@13.220.157.42 'sudo bash /opt/mizan/deploy-vps.sh'
```

`scripts/deploy-vps.sh` is idempotent and defaults to `/opt/mizan` / `mizan` / `3000`.

## Rollback

The deploy ships build output, not history — roll back by redeploying an older commit:

```bash
git revert <bad-commit>     # or reset main to a known-good commit
git push origin main        # CD redeploys
```

For an emergency without waiting on CI, build that commit locally and run the
manual steps above. **Migrations are forward-only** — reverting a commit that
added a migration does not undo the schema change; write a new migration for that.

## Demo instance

The current deployment sets `MIZAN_SEED_DEMO=true` (seeds org "Mizan" + 7 users;
login `amira.tawfik@tawfikpartners.eg` / `demo-password-2026`) and is built with
`VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` so the sign-in form arrives pre-filled.
Remove the env var, the build args, and wipe the demo data before real use.
