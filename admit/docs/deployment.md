# Admit — deployment

Same shape as Raqib and HotelOS: a separate Node service + its own Postgres database, a static web app, and (new) one small Python worker.
Nothing here has been deployed yet; these are the steps and the checks.

## 1. Database

```sql
CREATE DATABASE admit;           -- own database; never reuse another product's
```

Migrations run as the schema owner (`AURIC_DATABASE_URL`) on boot (`prisma migrate deploy`). The runtime uses the two Core roles:

| Variable | Role | RLS |
|---|---|---|
| `AURIC_APP_DATABASE_URL` | `auric_app` | enforced: every request |
| `AURIC_SYSTEM_DATABASE_URL` | `auric_system` | bypassed: guest checkout slug lookup, jobs, **and the email worker** |

## 2. API (`admit/backend`)

```
cd admit/backend && npm run build        # dist/admit/backend/main.js
node dist/admit/backend/main.js          # migrates, seeds roles, serves :3400
```

Required in production: `AURIC_JWT_SECRET` (its own), `ADMIT_TICKET_KEY` (**32 random bytes, base64**: `openssl rand -base64 32`;
back it up with the DB password - QR tokens and booking links are derived from it, so losing it invalidates issued tickets),
`ADMIT_PUBLIC_URL` (the web origin, used in email links), `ADMIT_API_URL` (public API origin, used for QR images in email),
`ADMIT_TRUSTED_PROXY_HOPS=1` behind nginx, `AURIC_CORS_ORIGINS` (the web origin) when the web is on another origin, and the file store
(`AURIC_FILE_STORAGE_DRIVER=r2` + `AURIC_R2_*`, bucket CORS allowing the web origin for `PUT`). `ADMIT_SEED_DEMO=true` is refused in production
unless `ADMIT_ALLOW_DEMO_IN_PRODUCTION=true` (a dedicated showcase deployment only).

## 3. Email worker (`admit/worker`)

```
python -m venv .venv && .venv/bin/pip install .
ADMIT_WORKER_DATABASE_URL=<auric_system url> ADMIT_WORKER_TRANSPORT=smtp \
ADMIT_WORKER_SMTP_URL=smtps://user:pass@host:465 ADMIT_WORKER_MAIL_FROM='Admit <tickets@yourdomain>' \
.venv/bin/python -m admit_worker
```

Run it under systemd (restart always); more than one instance is safe. See `deploy/admit-worker.service`. Watch **Email delivery** in the
dashboard: a FAILED message has a Retry button and never affects the booking.

## 4. Web (`admit/web`)

`npm run build` → static `dist/`. On Vercel: root directory `admit/web`, set `VITE_API_BASE=https://<api>/api` and `VITE_ORG_SLUG=<default organizer slug>`;
add the API origin to the CSP `connect-src` / `img-src` (QR PNGs load from the API). Locally `vite` proxies `/api` to `:3400`.

## 5. Checks after deploying

1. `GET /api/health/ready` is OK; the dashboard signs in.
2. Create an event with a ticket type and a payment method, publish it, book it as a guest, upload proof, approve it, open the emailed link.
3. The ticket email row goes QUEUED → ACCEPTED within a few seconds (worker running); the QR image loads.
4. Scan the ticket on a phone over HTTPS (camera needs a secure origin); a second scan says "Already used".
5. `npm run e2e` in `admit/web` against a staging copy if you want the whole journey re-proved.
