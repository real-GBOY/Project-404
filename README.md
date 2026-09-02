# AURIC

**A domain-agnostic application foundation, and the first real product built on it.**

This repository is two things with a hard seam between them:

| | | |
|---|---|---|
| **`core/`** | **AURIC Core** — a versioned, reusable platform: identity, RBAC, multi-tenancy, files, audit, notifications, an event/outbox system, localization, observability. It knows nothing about any business domain. | 94 source files · 13 test suites |
| **`mizan/`** | **Mizan** (codename *Project 404*) — a law-firm management system for *Tawfik & Partners*. **Project #1**: the first application built on Core, and the proof that Core's contracts hold under a real product. | web: 213 files · 78 tests · F0–F16 done |

> **AURIC is not a law-firm ERP.** It is the foundation. Mizan is the ERP, *powered by* AURIC Core. The next client after Mizan will not re-implement auth, tenancy, permissions, file storage, an audit trail, or an outbox — that is the entire point.

---

## Architecture

```
   CLIENTS          mizan/web  ·  mizan/mobile (Phase 2)
                    React 19 + Vite      React Native
                         │
                         │   HTTP / JSON only — the clients share no code with the server
                         ▼
   MIZAN BACKEND    mizan/backend/app/
                    clients · matters · hearings · tasks · documents
                    billing · staff · dashboard · settings
                         │
                         │   core/contracts interfaces + DI tokens only — never a Core table
                         ▼
   AURIC CORE       core/
                    identity · rbac · organizations · tenancy · files
                    audit · notifications · events · localization
                    observability · http · kernel
                         │
                         ▼
   INFRASTRUCTURE   PostgreSQL (+ row-level security) · local disk · SMTP
```

**Dependencies flow one way, and only one way:**

```
AURIC CORE  ◀──  MIZAN BACKEND  ◀──  { mizan/web, mizan/mobile }
```

- `core/` **must never** import from `mizan/`. Verified: `grep -rn "mizan/" core/` is empty. If a symbol in Core names a `Matter`, a `Hearing`, or an `Invoice`, it is in the wrong place.
- `mizan/backend/` reaches Core **only** through `core/contracts` interfaces (`IUserProvider`, `IPermissionProvider`, `ITenantContext`, `IFileStorage`, `IAuditLogger`, `IEventBus`, …) and DI tokens — never a Core table or concrete class. One sanctioned exception: the boot-time seed.
- `mizan/web/` imports **no repository code at all**. It consumes the HTTP API and re-implements the few shared rules (the `action:resource` permission matcher, the `ar-EG` formatters) rather than importing them.

The full contract — what each side owns, why there is no `modules/` or `client-002/` folder yet — is **[`docs/mizan-project-one.md`](docs/mizan-project-one.md)**.

### Principles the code actually enforces

| Principle | How it shows up |
|---|---|
| **Modular monolith, not microservices** | One NestJS process. Feature `@Module`s, clean layer boundaries, no network hops between domains. |
| **Rule of Three** | No capability is extracted into a reusable AURIC module until it has been built across **three** real client projects. Mizan is client #1 — nothing is extracted. |
| **The database is the security boundary** | Postgres row-level security + `organization_id NOT NULL` on every tenant table. A forgotten `WHERE` clause in application code cannot leak across tenants. Frontend `can()` is UX only. |
| **Every use case owns its transaction** | `authenticate → validate → transaction → persist → publish event`. The event bus never opens a transaction. |
| **Prisma owns schema, Kysely owns runtime** | Prisma defines tables + migration history and generates Kysely's types. No Prisma Client, no ORM at runtime — typed SQL only. |
| **Money is never summed across currencies** | Financial values are `{ currency, amount }[]`, rendered as stacked lines. No FX, no "dominant currency". Invoice math is server-authoritative. |
| **Arabic-first** | AR is the default language, RTL is first-class (logical CSS only), `ar-EG` number/date/currency formatting, bilingual notification templates. |

---

## What's built

### AURIC Core — `core/` ✅ v0.1 shipped

| Capability | Module | State |
|---|---|---|
| Identity & auth — register, login, logout, refresh, email verification, password reset, Argon2id | `core/identity` | ✅ |
| RBAC — User / Role / Permission, `can(user, action, resource)`, wildcards, `action:resource` keys | `core/rbac` | ✅ |
| Organizations & membership — an organization **is** the tenant | `core/organizations` | ✅ |
| **Multi-tenancy** — global identity, shared schema, `SET LOCAL` per transaction, **Postgres RLS backstop** (`auric_app` NOBYPASSRLS / `auric_system` BYPASSRLS) | `core/kernel/tenant` | ✅ built + integration-tested (cross-tenant leakage, `WITH CHECK` containment, per-tenant outbox) |
| Files — upload / download / delete / metadata, RBAC-gated, swappable adapter (local disk) | `core/files` | ✅ |
| Audit — append-only trail, queryable, DB-enforced immutability | `core/audit` | ✅ |
| Notifications — in-app + email, templated, bilingual (AR/EN), delivered via the outbox | `core/notifications` | ✅ |
| Events — in-process bus + **transactional outbox** + worker + dead-letter queue + backlog health check | `core/events` | ✅ |
| Localization — language/direction resolution, `ar-EG` formatters | `core/localization` | ✅ |
| Observability — structured logs, correlation IDs, `/health`, `/health/ready` | `core/observability` | ✅ |
| HTTP — Zod pipe, `JwtAuthGuard` + `PermissionGuard` + `@RequirePermission`, exception filter, request-context middleware | `core/http` | ✅ |

8 Prisma schema files · 4 migrations · 2 integration suites that boot the real Core against a throwaway Postgres.

### Mizan backend — `mizan/backend/app/` 🚧 Part-1 in progress

- ✅ Composition root (`app.module.ts`), the **two-layer seed** (Core platform permissions, then law-firm permissions + the roles `firm_admin · partner · lawyer · paralegal · finance · read_only`), product version.
- ✅ Law-firm permission definitions for all 9 domains (`create:matter`, `void:invoice`, `record:payment`, …) contributed into Core RBAC.
- 🚧 **Current build front:** the feature modules (matters, hearings, tasks, documents, billing, staff, dashboard) — each ships `domain / application / infrastructure / api / events / permissions / validation / tests` and proves **Tenant A ⊗ Tenant B** isolation before it lands.

### Mizan web — `mizan/web/` ✅ F0–F16 complete

The entire product surface, live against a mock API layer shaped to the frozen Part-1 contracts:

`dashboard` · `clients` (+6 tabs) · `matters` (+7 tabs, "Case Work" group) · `hearings` · `tasks` · `documents` · `calendar` (month grid) · `billing` (invoices / payments / expenses + server-computed invoice detail) · `team` (utilisation) · `notifications` inbox · `settings` (7 sections — Users & roles → real `/api/rbac`, audit → real `/api/audit-logs`, locale switch) · "Ask Mizan" assistant (canned demo drawer, no fake results)

- **213** source files · **~37** design-system primitives (Radix, fully restyled to Mizan tokens) · **13** feature areas · **29** test files / **78** tests · typecheck + lint + build green every phase.
- Stack: Vite 6 · React 19 · TypeScript · Tailwind v4 (semantic tokens) · Radix · TanStack Query v5 · React Router v7 · react-hook-form + Zod · i18next (AR default + RTL) · MSW.
- Permission-aware nav, actions, and routes from the exact keys `/api/me` returns. Code-split feature routes, split vendor chunks. Auth / notifications / RBAC / audit already call real endpoints; the rest cut over per feature by deleting one mock handler file.

---

## Repository layout

```
auric/
├── core/                     AURIC Foundation — reusable, versioned, domain-agnostic
│   ├── kernel/               config · db (pools + Kysely + unit-of-work + migrate runner) · logging · tenant · ids · clock · errors · DI tokens
│   ├── contracts/            the provider interfaces every module is consumed through (Plan §4)
│   ├── events/               in-process bus + outbox + worker + DLQ
│   ├── identity/ rbac/ organizations/ audit/ files/ notifications/     (each a @Module + controller + full anatomy)
│   ├── localization/ observability/ http/ bootstrap/
│   ├── app.module.ts         Core's own test-fixture root (NOT the running one)
│   └── index.ts              public surface — modules, tokens, contracts
│
├── mizan/                    Project #1 — the Mizan law-firm application
│   ├── backend/app/          composition root · layered seed · law-firm domain (lawfirm/)
│   ├── web/                  standalone Vite package (mizan-web) — HTTP API only, no repo imports
│   └── mobile/               Phase 2 (placeholder)
│
├── prisma/                   schema (mirrors every table) + migration history — Core + lawfirm
├── scripts/                  migrate · provision-db
├── http/                     .http request files for the API
├── docs/                     architecture, tenancy, integration guide, conventions
└── main.ts                   entrypoint — migrate → NestFactory (Fastify adapter) → seed → listen :3000
```

Every module — Core or Mizan — follows the same anatomy (`domain / application / infrastructure / api / events / permissions / validation / tests`), so any developer can navigate any module. Table schema lives in `prisma/schema/<module>.prisma`, not the module folder.

`main.ts` and all build config stay at the repo root: the backend is one npm package (`@auric/core`) rooted where `core/` is, and `mizan/backend/app/` is its Mizan-specific slice.

---

## Stack

TypeScript · Node **22.12+ / 24** · PostgreSQL only ·
**NestJS 11 on `@nestjs/platform-fastify`** (Fastify 5) · SWC transform (decorator metadata — esbuild can't) ·
Kysely (typed query builder, no ORM) · Prisma (schema + migrations only — no Prisma Client) ·
Zod · `jsonwebtoken` + `argon2` (argon2id) · `nodemailer` · `pino` · Vitest.

> Node **22.12+ or 24+** required (Prisma won't install on odd majors like 23.x). `.nvmrc` pins 24 — `nvm use`.

---

## Quick start

### Backend

```bash
npm install
cp .env.example .env          # set AURIC_DATABASE_URL etc.
createdb auric
npm run provision-db          # once — give auric_app / auric_system a login (see docs/tenancy.md)
npm run migrate               # prisma migrate deploy
npm run serve                 # migrate + Nest bootstrap + seed + serve on :3000
```

```bash
curl localhost:3000/api/health
curl localhost:3000/api/health/ready      # 503 if the outbox worker is stopped or backed up
```

### Web

```bash
cd mizan/web
npm install
npm run dev                   # http://localhost:4300 — MSW mock layer on
# sign in: any valid email + any password ≥ 10 characters
```

Point the web client at a real backend with `VITE_API_MOCKS=off` (Vite proxies `/api` → `:3000`).

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run serve` / `npm run dev` | Run the whole modular monolith in one process (`dev` = with reload) |
| `npm run migrate` / `migrate:status` | Apply / inspect Prisma migrations |
| `npm run migrate:dev` | Author a new migration |
| `npm run db:generate` | Regenerate `core/kernel/db/schema.ts` from `prisma/schema/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Core unit + integration (integration needs a Postgres) |

Web (`cd mizan/web`): `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test`.

### Tests

Core unit tests run anywhere. Integration tests (`core/tests/`) boot the real Core against a throwaway database:

```bash
AURIC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/auric_test npm test
```

They cover the things that must not regress: an unauthorized action is blocked, a permission change takes effect, **tenant A cannot see tenant B**, RLS cannot be bypassed, the outbox delivers exactly once.

---

## Architectural contracts

Every reusable capability carries its **architectural contract** next to the code — what it owns, what it does *not*, its interfaces, dependency direction, invariants, and when *not* to reuse it:

| | |
|---|---|
| [`core/README.md`](core/README.md) | AURIC Core as a whole — the Core ↔ product boundary |
| `core/contracts/` · `core/kernel/` · `core/events/` | the foundation layer |
| `core/identity/` · `core/rbac/` · `core/organizations/` | auth & access |
| `core/files/` · `core/audit/` · `core/notifications/` | capabilities |
| `core/localization/` · `core/observability/` · `core/http/` · `core/bootstrap/` | cross-cutting |
| [`mizan/README.md`](mizan/README.md) · [`mizan/backend/app/README.md`](mizan/backend/app/README.md) | **Mizan** (Project #1) — the Core ↔ Mizan boundary |
| [`mizan/web/README.md`](mizan/web/README.md) | **Mizan** web client — API-only, imports no repo code |

### Docs

| Doc | Scope |
|---|---|
| [`Plan.md`](Plan.md) | the AURIC constitution / governing rules |
| [`docs/system-architecture.md`](docs/system-architecture.md) | the canonical destination vision (50 sections) |
| [`docs/mizan-project-one.md`](docs/mizan-project-one.md) | **Mizan = Project #1** — physical layout, the authoritative Core ↔ Mizan boundary, why there is no `modules/` / `client-00N/` yet |
| [`docs/architecture.md`](docs/architecture.md) | Core v0.1 as-built |
| [`docs/tenancy.md`](docs/tenancy.md) | the multi-tenancy design + rollout |
| [`docs/integration-guide.md`](docs/integration-guide.md) | building a client project on Core |
| [`docs/conventions.md`](docs/conventions.md) | code conventions |
