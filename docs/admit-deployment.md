# Admit deployment

Admit is **live** (a showcase deployment with the demo organizer, like the other products):

| Part | Where | Notes |
|---|---|---|
| **Web** (customer site, dashboard, scanner) | **https://admit-web-lime.vercel.app** (Vercel project `admit-web`, team `gboys-projects-b23d1180`) | `VITE_API_BASE`, `VITE_ORG_SLUG=nile-sessions`, `VITE_DEMO=true` |
| **API** | **https://admit.162-35-28-116.sslip.io/api** (systemd `admit`, `127.0.0.1:3400`, user `admit`, `/opt/admit/backend`) | nginx + Let's Encrypt, API only |
| **Email worker** | systemd `admit-worker`, `/opt/admit/worker` (Python venv) | transport `log` for now, see "Email" |
| **Database** | `admit` on the box's PostgreSQL, shared `auric_app` / `auric_system` roles | its own database, nothing shared with Raqib |
| **Files** | Cloudflare R2 bucket **`admit-files`** (Western Europe, same account as `raqib-files`): payment proofs, uploaded straight from the browser over presigned URLs | bucket CORS allows `*.vercel.app` and the local dev ports |

It runs on the **same VPS as Raqib** (Interserver, `root@162.35.28.116`, 1 vCPU, 1.6 GB RAM + swap). The two products share the machine, nginx
and the PostgreSQL cluster and nothing else: separate directories, system users, ports, databases, secrets and certificates.
See [backend-deployment-overview.md](backend-deployment-overview.md) for the recipe every product follows.

## Day to day

```bash
bash scripts/deploy-admit-local.sh                # build admit/backend, ship dist/, restart, wait for /api/health
SKIP_BUILD=1 bash scripts/deploy-admit-local.sh   # ship the existing dist/
```

The script streams `admit/backend/dist` as a tarball, copies the root `package.json` / `package-lock.json` and
`admit/backend/deploy-vps.sh`, and runs the latter on the box. `deploy-vps.sh` runs `npm ci --omit=dev` only when the lockfile changed, restarts
`admit`, and waits for `/api/health`. Pending migrations run on boot, so the restart is the whole cutover. It never touches `.env`.

Web: it needs `packages/web` (the shared HTTP client) next to `admit/web`, so the Vercel project's root directory is `admit/web` with source
files outside the root enabled. Once the repository is connected, a push to `main` deploys it. Until then deploy from a clean copy that
contains only `admit/web` and `packages/web` (never the repository root, which holds the SSH key):

```bash
VERCEL_ORG_ID=<team id> VERCEL_PROJECT_ID=<project id> npx vercel deploy --prod --yes --token <token>
```

Worker (after a change under `admit/worker`):

```bash
tar -czf - --exclude=.venv --exclude=outbox --exclude=__pycache__ --exclude=.env -C admit/worker . \
  | ssh -i me root@162.35.28.116 'tar -xzf - -C /opt/admit/worker && /opt/admit/worker/.venv/bin/pip install -q /opt/admit/worker \
      && chown -R admit:admit /opt/admit/worker && systemctl restart admit-worker'
```

## One-time setup (already done)

`admit/deploy/provision-vps.sh <api-host> <web-origin>` does it on the box, idempotently, and never prints a secret:

1. system user `admit`, directories `/opt/admit/{backend,worker,storage}`, database `admit`;
2. `/opt/admit/backend/.env` (mode 600): a new `AURIC_JWT_SECRET` and **`ADMIT_TICKET_KEY`** generated on the box, the shared role passwords
   read from Raqib's `.env` and pointed at database `admit`, the R2 settings (account and S3 token copied from Raqib's `.env`, bucket
   `admit-files`), CORS, public/API URLs, demo flags;
3. the `admit` and `admit-worker` systemd units (`admit/deploy/*.service`), the nginx server block (API only; `/` redirects to the web
   app) and the Let's Encrypt certificate;
4. then the API is shipped with `scripts/deploy-admit-local.sh`, the worker venv is created (`apt install python3-venv` once) and its `.env`
   points at `auric_system`.

**Back up `ADMIT_TICKET_KEY`** with the database password. Every QR token and booking link is derived from it: losing it invalidates
every issued ticket and every emailed link.

## Payment proof storage (R2)

The guest's proof upload is three steps: `POST .../proof/presign` (the API checks type and size and returns a presigned PUT URL), the browser
`PUT`s the file **directly to R2**, then `POST .../proof` attaches it to the booking as a submission. Staff view a proof through
`GET /api/admit/payments/:id/proof`, which the API streams from R2 after the permission check, so a proof is never reachable by a plain link.

The bucket needs a CORS rule for the web origin (GET, PUT, HEAD, DELETE, any header, expose `ETag`). It was created with the Cloudflare API:
`admit-files`, location hint `weur`, origins `https://*.vercel.app` plus `http://localhost:4700` and `:4799`. The web CSP allows the upload with
`connect-src https://*.r2.cloudflarestorage.com`. Verified on the live site: a proof uploaded in the browser appears in the bucket with the right
size, and the reviewer sees it. The local disk driver remains for development (the API accepts the bytes itself for a guest's own pending proof).

## Demo mode on this deployment

`ADMIT_SEED_DEMO=true` plus `ADMIT_ALLOW_DEMO_IN_PRODUCTION=true` (Admit refuses the first flag in production without the second, on
purpose). On boot it seeds the organizer **Nile Sessions Events** (`/e/nile-sessions`) with 8 events and bookings in every state, played
through the real services. The sign-in page lists the demo accounts (`VITE_DEMO=true`); all use `demo-password-2026`. To go real, turn both
flags off on a fresh database and create the organizer and team through Core's identity and organization flows.

## Email

The worker runs with `ADMIT_WORKER_TRANSPORT=log`: every message is rendered from the real templates and written as an `.eml` file in
`/opt/admit/worker/outbox`, and the row goes `QUEUED -> ACCEPTED`. **Nothing leaves the box.** The box has no outgoing mail, as with Raqib.
To deliver for real, give the worker an SMTP account in `/opt/admit/worker/.env` and restart it:

```
ADMIT_WORKER_TRANSPORT=smtp
ADMIT_WORKER_SMTP_URL=smtps://user:password@smtp.example.com:465
ADMIT_WORKER_MAIL_FROM=Admit <tickets@your-domain>
```

Use an address on a domain you control (SPF/DKIM) so the mail is not filtered. A message the provider refuses ends as `FAILED` and shows in
the dashboard's **Email delivery** with a Retry button; it never affects the booking or its tickets.

## Backups

`/opt/admit/admit-backup.sh` (source: `scripts/admit-backup.sh`) runs from root's crontab at 03:30: a verified `pg_dump -Fc` into
`/var/backups/admit` (14 kept). Payment proofs live in R2, not on the box, so they are not in this backup. These copies are on the same machine; copy
them off the box (for example with `scp`) before relying on them against losing the server. Restore:

```bash
sudo -u postgres createdb admit_restore && sudo -u postgres pg_restore -d admit_restore /var/backups/admit/admit-YYYY-MM-DD.dump
```

## Web security headers

`admit/web/vercel.json` sets a Content-Security-Policy that allows scripts from the site only, the API origin for `fetch` and images (QR
codes, payment proofs), the hosted QR picture, Google Fonts, `camera=(self)` for the scanner, no framing, and the single-page-app rewrite.
If the API host changes, update `connect-src` and `img-src` there.

## Checks after a deploy

1. `curl https://admit.162-35-28-116.sslip.io/api/health/ready` is `ready` (database and outbox ok).
2. The web app lists the Nile Sessions events and the sign-in page signs in as `karim@nilesessions.example`.
3. Book as a guest on the site and upload a proof: it reaches R2 (the upload step shows "Uploaded"), and in the review queue the image loads (streamed by the API).
4. A booking made on the site shows in the queue; approving it queues the ticket email and the worker accepts it
   (`journalctl -u admit-worker -n 20`).
5. `/scan` signs in as `ali@nilesessions.example` and a ticket ID entered by hand answers "Entry approved" once and "Already used" after.

## Operating notes

- Logs: `journalctl -u admit -f`, `journalctl -u admit-worker -f`. Status: `systemctl status admit admit-worker`.
- Memory is tight with Raqib on the same box: the API is capped at 300 MB of heap (`NODE_OPTIONS` in the unit).
- Rate limits are per client address behind nginx (`ADMIT_TRUSTED_PROXY_HOPS=1`).
- The Vercel API token and the box's SSH key were pasted into chat sessions: **rotate them** and keep them out of the repository.

## Not on this deployment

Outgoing mail (see Email), off-machine database backups, malware scanning of proof uploads, a custom domain (the sslip.io hostname stands in for one),
and provider delivery webhooks (the top email status is `ACCEPTED`).
