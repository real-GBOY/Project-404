# AURIC Core

A thin, versioned cross-cutting foundation reused across AURIC client projects.
This is **v0.1** — the minimum "start here" set from the
[build specification](./Plan.md), extracted to a working codebase.

> Governing rule (Plan §0): if a feature has not been required by a real
> project and is not fundamental infrastructure, it does not belong in Core
> yet. v0.1 contains only the infrastructure whose shape is well understood.

## What's in v0.1

| Capability | Module | Plan ref |
|---|---|---|
| Identity & auth — register, login, logout, refresh, email verification, password reset, Argon2 hashing | `core/identity` | §7.1 |
| RBAC — User / Role / Permission, `can(user, action, resource)`, wildcards | `core/rbac` | §7.2 |
| Organizations & members | `core/organizations` | §7.4 |
| Audit — append-only trail, queryable, DB-enforced immutability | `core/audit` | §7.7 |
| Files — upload / download / delete / metadata, RBAC-gated, local-disk driver | `core/files` | §7.6 |
| Notifications — in-app + email, templated, bilingual (AR/EN) | `core/notifications` | §7.5 |
| Localization — Arabic-first, RTL, AR/EN content, AR-EG formatting | `core/localization` | §7.10 / §12A |
| Observability — structured logs, correlation IDs, health + readiness | `core/observability` | §7.12 |
| Event system — in-process bus + transactional outbox + worker + DLQ | `core/events` | §6 |

**Deliberately not here** (Plan §8): multi-tenancy, workflow engine, reporting
skeleton, SMS/push, 2FA. Each enters a later version only when a real project
pulls it in.

### Why the outbox is already in v0.1

Plan §8 says "no outbox until the first external side effect appears." Identity's
email verification and password reset *are* that first external side effect, so
the transactional outbox, its worker, the dead-letter queue, and worker
monitoring (§7.12, §6.2) come in with v0.1. See `docs/architecture.md`.

## Stack

TypeScript · Node ≥ 20 · PostgreSQL (only — no Mongo in v0.1) · Express 5 ·
Kysely (typed query builder, no ORM) · Zod · `jsonwebtoken` + `argon2` ·
`nodemailer` · `pino` · Vitest.

## Quick start

```bash
npm install
cp .env.example .env          # adjust AURIC_DATABASE_URL etc.
createdb auric                # or: psql -c 'create database auric'
npm run migrate               # apply all module migrations
npm run serve                 # migrate + seed + start worker + serve on :3000
```

Then:

```bash
curl localhost:3000/api/health
curl localhost:3000/api/health/ready      # includes outbox-worker backlog
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run serve` | Run the whole modular monolith in one process |
| `npm run dev` | Same, with reload |
| `npm run migrate` / `migrate:down` / `migrate:status` | Migrations |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit + integration (integration needs a Postgres; see below) |

### Tests

Unit tests run anywhere. Integration tests (`core/tests/`) boot the real Core
against a throwaway database. Point them at one with:

```bash
AURIC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/auric_test npm test
```

Locally they default to `…/auric_test` if that env var is unset.

## Layout

```
core/
├── kernel/         config, db (pool + Kysely + unit-of-work), logging, ids, clock, errors
├── contracts/      the provider interfaces every module depends on (Plan §4)
├── events/         in-process bus + outbox + worker + DLQ (Plan §6)
├── identity/  rbac/  organizations/  audit/  files/  notifications/
├── localization/   language, direction, AR-EG formatting (Plan §7.10)
├── observability/  correlation id, request log, error handler, health
├── http/           shared route helpers + route context
└── index.ts        the composition root — wires everything, mounts /api
```

Every module follows the same anatomy (`domain/ application/ infrastructure/
api/ events/ permissions/ validation/ migrations/ tests/`) so any AURIC
developer can navigate any module — Plan §3.2.

See `docs/` for architecture, integration, and conventions.
