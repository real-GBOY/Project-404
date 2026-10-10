# Admit

Event ticketing with **manual payment verification** for Egypt: guests book, pay the organizer directly (InstaPay, wallet, bank), upload
proof; a reviewer approves it; tickets with QR codes are issued and emailed; door staff scan each ticket exactly once. Built on AURIC Core
as its own deployment (own database, own users), like Mizan, Atlas, HotelOS and Raqib.

| Part | Folder | Stack |
|---|---|---|
| API | [`backend/`](backend) | NestJS + Fastify, Kysely/Prisma, AURIC Core by source |
| Web | [`web/`](web) | React 19, Vite, Tailwind 4: customer site, organizer dashboard, door scanner |
| Email worker | [`worker/`](worker) | Python 3.11+, psycopg, Jinja2: drains the transactional email outbox |
| Docs | [`docs/`](docs) | [architecture, audit & limitations](docs/architecture.md) · [deployment](docs/deployment.md) |

## Run it locally

```bash
createdb admit                                    # once (any Postgres 12+)
cd admit/backend && cp .env.example .env          # set ADMIT_SEED_DEMO=true for the demo organizer
npm run serve                                     # migrates, seeds, serves :3400
cd ../web && npm install && npm run dev           # http://localhost:4700  (proxies /api)
cd ../worker && python -m venv .venv && .venv/bin/pip install -e ".[dev]"
ADMIT_WORKER_DATABASE_URL=postgres://postgres:postgres@localhost:5432/admit .venv/bin/python -m admit_worker   # writes ./outbox/*.eml
```

Demo organizer **Nile Sessions Events** (`/e/nile-sessions`); sign in at `/admin` as `salma@` (owner), `dalia@` (event manager), `karim@`
(payment reviewer), `ali@` (door staff, `/scan`), `mona@` (viewer) `@nilesessions.example`, password `demo-password-2026`.

## Test it

```bash
cd admit/backend && npm run ci        # typecheck, lint, format, 52 integration tests (needs Postgres), build
cd admit/web && npm test && npm run e2e   # 29 unit tests; the browser journey against the real backend (needs Chrome)
cd admit/worker && .venv/bin/python -m pytest
```

## Where it sits in the repo

`core/` is the shared foundation and is not changed by Admit. Admit's product code is in `backend/app/admit/`; Core never imports it.
Conventions copied from the other products: `@admit/*` aliases, composition root `app/app.module.ts`, hand-written migrations with FORCE'd RLS,
Prisma only for schema definition and Kysely types, `core/` imported by source, no dependencies inside `backend/`.
