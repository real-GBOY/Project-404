# Admit deployment

Admit is **live** (a showcase deployment with the demo organizer, like the other products):

| Part | Where | Notes |
|---|---|---|
| **Web** (customer site, dashboard, scanner) | **https://admit-web-lime.vercel.app** (Vercel project `admit-web`, team `gboys-projects-b23d1180`) | `VITE_API_BASE`, `VITE_ORG_SLUG=nile-sessions`, `VITE_DEMO=true` |
| **API** | **https://admit.162-35-28-116.sslip.io/api** (systemd `admit`, `127.0.0.1:3400`, user `admit`, `/opt/admit/backend`) | nginx + Let's Encrypt, API only |
| **Email worker** | systemd `admit-worker`, `/opt/admit/worker` (Python venv) | SMTP through the Gmail account `nayelthedev404@gmail.com` (an app password), see "Email" |
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

The worker sends over SMTP with a Gmail account, `nayelthedev404@gmail.com`, authenticated by a Google **app password** (2-step verification
on). The settings live only in `/opt/admit/worker/.env` on the server (mode 600), never in the repository:

```
ADMIT_WORKER_TRANSPORT=smtp
ADMIT_WORKER_SMTP_URL=smtps://nayelthedev404%40gmail.com:<app password>@smtp.gmail.com:465
ADMIT_WORKER_MAIL_FROM=Admit <nayelthedev404@gmail.com>
```

Restart with `systemctl restart admit-worker`. A Gmail sender is fine for a demo (about 500 messages a day, and the "from" is a personal address);
for real customers use a transactional provider on a domain you control (SPF/DKIM) and change only these three lines. A message the
provider refuses ends as `FAILED` and shows in the dashboard's **Email delivery** with a Retry button; it never affects the booking or its tickets.

**The ticket QR travels inside the email.** At send time the worker downloads each ticket's QR PNG from the API and attaches it as an inline
image (`cid:`), so it shows without "display images" and offline. If the download fails the email still goes out with the remote link. The QR
encodes the organizer's picture URL plus `#<ticket token>`: a phone camera opens the picture, the door scanner reads the token.

## Backups

`/opt/admit/admit-backup.sh` (source: `scripts/admit-backup.sh`, with `backend/scripts/offsite-backup.mjs`) runs from root's crontab at 03:30:

1. a verified `pg_dump -Fc` into `/var/backups/admit` (14 kept) on the box;
2. the same dump copied **off the machine** into R2 (`admit-files`, folder `backups/`, 14 days kept) and read back to check its size, so losing the
   server does not lose the data. Payment proofs are already in R2, so they are not in the dump.

Restore (to a scratch database first, to prove the dump is good):

```bash
sudo -u postgres createdb admit_restore && sudo -u postgres pg_restore -d admit_restore /var/backups/admit/admit-YYYY-MM-DD.dump
```

If the box is lost, download `backups/admit-YYYY-MM-DD.dump` from the bucket (Cloudflare dashboard or the R2 API) and restore it on a new box
with the same `ADMIT_TICKET_KEY`.

## Hardening

`admit/deploy/harden-vps.sh` (idempotent; already applied) adds, for Admit's own nginx site only:

- security headers on every API answer (HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`);
- request limits per client address: sign-in 10 a minute with a burst of 5, the public booking routes 120 a minute (HTTP 429 beyond that,
  and the sign-in page says "wait a minute");
- fail2ban for SSH (the stock `sshd` jail).

The box also runs a firewall allowing only SSH, HTTP and HTTPS, and automatic security updates. SSH currently still accepts passwords for root:
switch to keys only (`PasswordAuthentication no`) once you have confirmed a key works for you.

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

## Going live with a real organizer

See [admit/docs/go-live.md](../admit/docs/go-live.md): onboarding with `npm run provision` (no demo data), secrets to rotate, a real email
sender, refunds, personal data, monitoring and a rehearsal checklist.

## Operating notes

- Logs: `journalctl -u admit -f`, `journalctl -u admit-worker -f`. Status: `systemctl status admit admit-worker`.
- Memory is tight with Raqib on the same box: the API is capped at 300 MB of heap (`NODE_OPTIONS` in the unit).
- Rate limits are per client address behind nginx (`ADMIT_TRUSTED_PROXY_HOPS=1`).
- The Vercel API token and the box's SSH key were pasted into chat sessions: **rotate them** and keep them out of the repository.

## Not on this deployment

A transactional email provider on your own domain (see Email), malware scanning of proof uploads, a custom domain (the sslip.io hostname stands in for one),
and provider delivery webhooks (the top email status is `ACCEPTED`).
