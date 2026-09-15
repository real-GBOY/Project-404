# Project-404

NestJS 11 · Fastify · PostgreSQL + RLS · Kysely · TypeScript · MIT

**A domain-agnostic application foundation, and two real products built on it.**

This repository is a foundation with a hard seam, and two independently-deployed products on the other side of it:

| | | |
|---|---|---|
| **`core/`** | **Project-404 Core** — a versioned, reusable platform: identity, RBAC, multi-tenancy, files, audit, notifications, an event/outbox system, AI-agent orchestration, localization, observability. It knows nothing about any business domain. | 12 capabilities · v0.1 shipped |
| **`mizan/`** | **Mizan** — a multi-tenant law-firm management system. **Project #1**: the first application built on Core, and the proof that Core's contracts hold under a real product. | backend domain complete · web F0–F16 · **202 tests green** |
| **`atlas/`** | **Atlas** — a real-estate developer OS (CRM, inventory, sales, payment plans, finance, ops) for an Egyptian developer. **Project #2**: a second, independently-deployed product on the same Core — its own package, its own database — built to see which parts of "Project #1" were actually reusable and which were Mizan-shaped. | backend + web complete · **80 backend / 5 web tests** |

**Run it:** `docker compose up --build` → Mizan API on `http://localhost:3000/api`, interactive docs on `http://localhost:3000/api/docs`. Atlas is a separate package with its own quick start — see [§ Atlas](#atlas) below.

> **Project-404 is not a law-firm ERP, and it isn't a real-estate OS either.** It is the foundation both are *powered by*. The bet was that the client after Mizan wouldn't re-implement auth, tenancy, permissions, file storage, an audit trail, or an outbox — Atlas is that bet paid off: same `core/`, a different domain, zero copy-pasted platform code. `core/assistant` is the one deliberate exception to the **Rule of Three** below: Mizan and Atlas built the same AI-orchestration loop independently, and rather than let a third product copy it again, it was pulled into Core at n=2 — every other capability still waits for three.

---

## Architecture

Two products, each its own deployable package and its own database, sharing one `core/` by source import — never by a running process or a shared schema:

```
   CLIENTS          mizan/web · mizan/mobile          atlas/web
                    React 19 + Vite / Expo            React 19 + Vite + Tailwind 4
                         │                                  │
                         │  HTTP / JSON only — no client shares code with any server
                         ▼                                  ▼
   PRODUCT BACKEND  mizan/backend/app/lawfirm/         atlas/backend/app/realestate/
                     clients · matters · hearings        crm · properties · sales · finance
                     tasks · documents · billing          operations · admin · dashboard
                     calendar · staff · activity          assistant (AI Copilot)
                     @auric/core package, :3000            @atlas/backend package, own port
                     database: auric                       database: atlas
                         │                                  │
                         │  core/contracts interfaces + DI tokens only — never a Core table
                         ▼                                  ▼
                          ─────────────  PROJECT-404 CORE  ─────────────
                          core/  — identity · rbac · organizations · tenancy
                          files · audit · notifications · events · assistant
                          localization · observability · http · kernel
                                            │
                                            ▼
                    INFRASTRUCTURE   PostgreSQL (+ row-level security) · local disk · SMTP
```

**Dependencies flow one way, and only one way, from either product:**

```
PROJECT-404 CORE  ◀──  MIZAN BACKEND  ◀──  { mizan/web, mizan/mobile }
PROJECT-404 CORE  ◀──  ATLAS BACKEND  ◀──  atlas/web
```

- `core/` **must never** import from `mizan/` or `atlas/`. Verified: `grep -rn "mizan/\|atlas/" core/` is empty. If a symbol in Core names a `Matter`, a `Hearing`, a `Lead`, or a `Unit`, it is in the wrong place.
- `mizan/backend/` and `atlas/backend/` each reach Core **only** through `core/contracts` interfaces (`IUserProvider`, `IPermissionProvider`, `ITenantContext`, `IFileStorage`, `IAuditLogger`, `IEventBus`, …) and DI tokens — never a Core table or concrete class. One sanctioned exception per product: the boot-time seed.
- `mizan/web/` and `atlas/web/` import **no repository code at all**. Each consumes its own product's HTTP API and re-implements the handful of shared rules (the `action:resource` permission matcher, formatting) rather than importing them.
- `atlas/backend` is not a module of the root package — it's `@atlas/backend`, its own `package.json`, its own Prisma migration history, its own Postgres database (`atlas`, vs. Mizan's `auric`). It imports `core/` via a relative path alias (`@core/* → ../../core/*`), the same source, compiled and run as a second, independent process.

The full Core ↔ Mizan contract — what each side owns, why there is no generic `modules/` or `client-00N/` folder — is **[`docs/mizan-project-one.md`](docs/mizan-project-one.md)**. Atlas repeats the same shape one level down, under `atlas/`.

### Principles the code actually enforces

| Principle | How it shows up |
|---|---|
| **Modular monolith, not microservices** | Each product is one NestJS process — feature `@Module`s, clean layer boundaries, no network hops between domains within a product. Two products means two processes, not a mesh. |
| **Rule of Three** | No capability is extracted into a reusable Project-404 module until it has been built across **three** real client projects — with one deliberate exception: `core/assistant`, pulled out at two products (Mizan Copilot, then Atlas Copilot duplicating it near-verbatim) rather than let a third product copy it again. Every other capability still waits for three; Atlas is client #2. |
| **The database is the security boundary** | Postgres row-level security + `organization_id NOT NULL` on every tenant table. A forgotten `WHERE` clause in application code cannot leak across tenants. Frontend `can()` is UX only. |
| **Every use case owns its transaction** | `authenticate → validate → transaction → persist → publish event`. The event bus never opens a transaction. |
| **Prisma owns schema, Kysely owns runtime** | Prisma defines tables + migration history and generates Kysely's types. No Prisma Client, no ORM at runtime — typed SQL only. |
| **Money is never summed across currencies** | Financial values are `{ currency, amount }[]`, rendered as stacked lines. No FX, no "dominant currency". Invoice and payment-plan math is server-authoritative in both products. |
| **Bilingual, RTL-first-class (Mizan)** | Mizan: English is the default; Arabic is fully supported and one switch away (persisted per user), RTL via logical CSS only, `ar-EG` formatting, bilingual notification templates. Atlas is English-only by design — an Egyptian developer's internal sales/ops tool, not a bilingual client-facing product. |

---

## What's built

### Project-404 Core — `core/` ✅ v0.1 shipped

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
| **AI Copilot orchestration** — LLM provider boundary, RBAC-gated tool-execution pipeline, scope-gate (heuristic → classifier, fail-open), conversation store. No HTTP surface, no domain knowledge — each product supplies its own tools, system prompt, and permission gates | `core/assistant` | ✅ the one capability extracted early (§ Rule of Three, above) — proven under two independent Copilots (Mizan's, Atlas's) |

**17** Core-only tables (of 37 total, the rest are Mizan's) across **9** schema files · **9** migrations in the root package's history — integration suites boot the real Core against a throwaway Postgres and run it as the `auric_app` / `auric_system` roles so `FORCE ROW LEVEL SECURITY` is actually exercised. (Atlas tracks its own, separate migration history against its own database — see § Atlas below.)

### Mizan backend — `mizan/backend/app/lawfirm/` ✅ domain complete

- **Two-layer seed** — Core platform permissions + `admin` wildcard role + bilingual templates, then law-firm permissions (`create:matter`, `void:invoice`, `record:payment`, …) across 9 domains + the roles `firm_admin · partner · lawyer · paralegal · finance · read_only`. No domain code branches on a role key — only on permissions.
- **Feature modules** — clients · matters · hearings · tasks · documents · billing · calendar · staff · dashboard · settings · activity — each ships `domain / application / infrastructure / api / events / permissions / validation / tests` and proves **Tenant A ⊗ Tenant B** isolation.
- 19 `lawfirm_*` tables, all `organization_id NOT NULL` + `tenant_isolation` RLS; child tables carry a composite FK to the parent so a row can't point across tenants.
- Financial calculation is server-authoritative (`fees + disbursements + VAT − payments`), per-currency, no FX.
- **124 backend tests** — unit + use-case + repo/integration + authz + tenant-isolation + outbox.

### Mizan web — `mizan/web/` ✅ F0–F16 complete, on the real backend

The entire product surface, cut over from the mock layer to the live API:

`dashboard` · `clients` (+6 tabs) · `matters` (+7 tabs, "Case Work" group) · `hearings` · `tasks` · `documents` · `calendar` (month grid) · `billing` (invoices / payments / expenses + server-computed invoice detail) · `team` (utilisation) · `notifications` inbox · `settings` (7 sections — Users & roles → `/api/rbac`, audit → `/api/audit-logs`, locale switch) · "Ask Mizan" assistant (canned demo drawer, no fake results)

- **213** source files · **~37** design-system primitives (Radix, fully restyled to Mizan tokens) · **13** feature areas · **78** tests · ESLint + Prettier + typecheck + build green.
- Stack: Vite 6 · React 19 · TypeScript · Tailwind v4 (semantic tokens) · Radix · TanStack Query v5 · React Router v7 · react-hook-form + Zod · i18next (EN default, AR one switch away, RTL).
- Permission-aware nav, actions, and routes from the exact keys `/api/me` returns. Code-split feature routes, split vendor chunks. The web app talks only to the real backend; the MSW layer moved to `src/test/` and is Vitest-only.

### Mizan mobile — `mizan/mobile/` ✅ all 18 design screens, on the real backend

The native client — a **separate client of the same API** as `mizan/web/` (rule 16: shares API contracts, never UI components).

`today` (dashboard) · `cases` (+ detail, hearings, tasks) · `calendar` · `files` (+ offline pinning) · `clients` (+ profile) · `finance` · quick-capture hub (expense → real upload + expense, log-time → real `/time-entries`) · "Ask Mizan" (honest "not connected" preview) · `more` (settings, audit log, locale switch) · `notifications`

- **~8,700 LOC** across **129 files** · **14** feature slices · **24** expo-router files · zero `any` in app code.
- Expo SDK 57 · React Native 0.86 · React 19 · New Architecture · Expo Router · TanStack Query v5 · i18next (EN/AR, full RTL via `I18nManager.forceRTL` + restart).
- API + auth layer is a near-verbatim port of the web client: one `httpClient`, single-flight `401` refresh, tokens in `expo-secure-store` (Keychain/Keystore), biometric unlock. Response types lifted from the web slices — both clients break at compile time if the contract moves.
- `tsc` · `eslint` · `prettier --check` · `expo export` (iOS/Android/web) · `expo-doctor` 21/21 all green. Full write-up in [`mizan/mobile/PROJECT_OVERVIEW.md`](mizan/mobile/PROJECT_OVERVIEW.md).

### Atlas backend — `atlas/backend/app/realestate/` ✅ complete, own package + database

The second product on Core, and the first real test of "is this actually reusable or just Mizan-shaped": a real-estate developer OS — CRM, inventory, sales, payment plans, finance, ops, AI Copilot.

- **23** `realestate_*` tables (own Prisma schema + own migration history, own `atlas` database — not a schema inside Mizan's) — leads → deals → reservations → contracts → payment plans → installments → payments, price lists, projects/buildings/units inventory, commissions, tasks/workflows/approvals, AI insights.
- **Feature modules** — `crm · properties · sales · finance · operations · admin · dashboard · assistant` — same `core/contracts`-only boundary as Mizan; `grep -rn "mizan/" atlas/` and `grep -rn "atlas/" core/` are both empty.
- **Atlas Copilot** (`assistant/`) — the product-specific 30% on top of `core/assistant`: real-estate tools (units, leads, reservations, collections, likely-to-sell ranking), its own system prompt and scope vocabulary, its own permission gates. Real Groq/OpenAI-compatible calls, not a scripted demo.
- **Every list screen's filters and search are backend-driven** — no client-side derivation from the currently-visible rows. A hand-written SQL relevance-ranking algorithm (`shared/search.ts`: exact → prefix → word-boundary → substring, weighted across columns) backs every `q` search param; KPI tallies query the unfiltered dataset separately so they read as portfolio totals, never "whatever the filter left."
- **80 backend tests**, one file per feature module, plus a live-Groq integration suite that hits the real AI provider (not mocked) to prove tool-calling and scope-refusal actually work.

### Atlas web — `atlas/web/` ✅ complete, on the real backend

- **111** source files across **12** feature areas — `crm · properties · sales · finance · operations · admin · dashboard · analytics · ai (Copilot) · auth · landing · shared`.
- All colors sourced from one file (`src/styles/colors.ts`), enforced by a sync test — no stray hex literals anywhere else in the app.
- Stack: Vite · React 19 · TypeScript · Tailwind 4 · Radix (a real `FilterDropdown` component, not a styled `<select>`) · TanStack Query v5 · React Router.
- Audited end-to-end before being shown externally: live-verified search/filter correctness against known data (not just "it renders"), a login-session race condition that could silently log a user out mid-session, a `NaN` on the customer detail page, and a duplicate-key bug in the global ⌘K search were all found and fixed by re-testing the running app, not just by reading the code.

### Continuous integration

**GitHub Actions** on every push and PR (`.github/workflows/ci.yml`): Mizan backend `typecheck · lint · format:check · test` (against a Postgres service, RLS enforced) `· build`; Mizan web `lint · typecheck · test · build`; mobile `lint · typecheck · format:check · expo-doctor · export`; the production Docker image builds; a VPS deploy job. **Atlas is not in this pipeline yet** — as a separate package with its own database, it's currently verified the same way (`typecheck · lint · test`, both `atlas/backend` and `atlas/web`) but by hand, not in CI. Adding an `atlas` job to `ci.yml` is the honest next step, not yet done.

---

## Repository layout

```
auric/
├── core/                     Project-404 Foundation — reusable, versioned, domain-agnostic
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
│   └── mobile/               standalone Expo package (mizan-mobile) — HTTP API only, no repo imports
│
├── atlas/                    Project #2 — the Atlas real-estate application (own package, own DB)
│   ├── backend/               @atlas/backend — own package.json, own prisma/ (schema + migrations),
│   │                          composition root · demo seeder · real-estate domain (realestate/)
│   │                          imports core/ via a relative path alias (@core/* → ../../core/*)
│   └── web/                   standalone Vite package (atlas-web) — HTTP API only, no repo imports
│
├── prisma/                   schema (mirrors every table) + migration history — Core + lawfirm only
│                              (atlas/backend/prisma/ is Atlas's own, separate history)
├── scripts/                  migrate · provision-db · build
├── http/                     .http request files for the API
├── docs/                     architecture, tenancy, integration guide, conventions
├── Dockerfile · docker-compose.yml · .github/workflows/ci.yml   (Mizan + mobile only — Atlas not wired in yet)
└── main.ts                   entrypoint — migrate → NestFactory (Fastify) → OpenAPI → seed → listen :3000
```

Every module — Core, Mizan, or Atlas — follows the same anatomy (`domain / application / infrastructure / api / events / permissions / validation / tests`, Atlas's real-estate module trims this slightly), so any developer can navigate any module. Table schema lives in `prisma/schema/<module>.prisma` (or `atlas/backend/prisma/schema/` for Atlas), not the module folder.

`main.ts` and all build config stay at the repo root: the Mizan backend is one npm package (`@auric/core`) rooted where `core/` is, and `mizan/backend/app/` is its Mizan-specific slice. Atlas is a second, sibling package (`@atlas/backend`) with its own entrypoint, root config, and database — it does not run inside the `@auric/core` process.

---

## Stack

TypeScript · Node **22.12+ / 24** · PostgreSQL only ·
**NestJS 11 on `@nestjs/platform-fastify`** (Fastify 5) · SWC for dev/tests, `tsc` for the production build (both emit the decorator metadata Nest's DI needs; esbuild can't) ·
Kysely (typed query builder, no ORM) · Prisma (schema + migrations only — no Prisma Client) ·
Zod · `@nestjs/swagger` (`/api/docs`) · `jsonwebtoken` + `argon2` (argon2id) · `nodemailer` · `pino` · Vitest ·
ESLint 9 + Prettier.

> Node **22.12+ or 24+** required (Prisma won't install on odd majors like 23.x). `.nvmrc` pins 24 — `nvm use`.

---

## Quick start

### With Docker (one command)

```bash
docker compose up --build
```

Brings up Postgres, applies migrations, provisions the two RLS roles, seeds a
demo firm, and serves the API:

```bash
curl localhost:3000/api/health
curl localhost:3000/api/health/ready      # 503 if the outbox worker is stopped or backed up
open  localhost:3000/api/docs             # interactive OpenAPI — click "Authorize", paste a token
```

Sign in to get a token — the compose file seeds a fictional firm:

```bash
curl -sX POST localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"mahmoud.nayel@tawfikpartners.eg","password":"demo-password-2026"}'
```

### Without Docker

```bash
npm install
cp .env.example .env                       # then set AURIC_JWT_SECRET etc.
createdb auric
npm run migrate                            # prisma migrate deploy (creates the auric_app / auric_system roles)
AURIC_APP_DB_PASSWORD=app AURIC_SYSTEM_DB_PASSWORD=sys npm run provision-db   # once — give those roles a login
# then in .env: AURIC_APP_DATABASE_URL=postgres://auric_app:app@localhost:5432/auric
#               AURIC_SYSTEM_DATABASE_URL=postgres://auric_system:sys@localhost:5432/auric
npm run serve                              # migrate → Nest bootstrap → OpenAPI → seed → :3000
```

> Skipping `provision-db` and the two role URLs also works for a quick look — the
> app then connects as the schema owner and RLS is present but not enforced.
> The roles are what make the isolation guarantees real (`docs/tenancy.md`).

### Web

```bash
cd mizan/web
npm install
npm run dev                                # http://localhost:4300 — proxies /api → :3000
```

The web client talks to the real backend; run the backend first. Register an
account at `/register`, or use a seeded demo login above.

<a id="atlas"></a>
### Atlas

A **separate package with its own database** — not part of the `docker compose` above.

```bash
cd atlas/backend
npm install
cp .env.example .env                       # already points at a separate `atlas` database — do not reuse Mizan's
createdb atlas
ATLAS_SEED_DEMO=true npm run serve          # migrate → Nest bootstrap → OpenAPI → demo seed → :3100
```

```bash
curl localhost:3100/api/health
curl -sX POST localhost:3100/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"mostafa.halim@atlas.eg","password":"demo-password-2026"}'
```

```bash
cd atlas/web
npm install
npm run dev                                # proxies /api → :3100
```

---

## Scripts

**Backend** (repo root):

| Command | Purpose |
|---|---|
| `npm run serve` / `npm run dev` | Run the modular monolith in one process (`dev` = reload; SWC at runtime) |
| `npm run build` → `npm start` | Compile to `dist/` (`tsc` + `tsc-alias`), then `node dist/main.js` |
| `npm run migrate` / `migrate:status` / `migrate:dev` | Apply / inspect / author Prisma migrations |
| `npm run provision-db` | Give `auric_app` / `auric_system` a login + password |
| `npm run db:generate` | Regenerate `core/kernel/db/schema.ts` from `prisma/schema/` |
| `npm run typecheck` · `lint` · `format` · `format:check` | `tsc --noEmit` · ESLint · Prettier |
| `npm test` · `npm run test:cov` | Vitest (integration needs a Postgres) |

**Web** (`cd mizan/web`): `dev` · `build` · `typecheck` · `lint` · `format` · `test`.

**Atlas** (separate packages — same script names, run from `atlas/backend` / `atlas/web`): `serve` / `dev` · `migrate` · `typecheck` · `lint` · `test`. `ATLAS_SEED_DEMO=true` on `serve`/`dev` seeds the demo developer portfolio.

### Tests

```bash
AURIC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/auric_test npm test
```

The harness resets the schema as the owner but runs the Core as `auric_app` /
`auric_system`, so `FORCE ROW LEVEL SECURITY` is exercised. It covers the things
that must not regress: an unauthorized action is blocked, a permission change
takes effect, **tenant A cannot see tenant B**, RLS cannot be bypassed, the
outbox delivers exactly once and dead-letters on exhaustion.

---

## Architectural contracts

Every reusable capability carries its **architectural contract** next to the code — what it owns, what it does *not*, its interfaces, dependency direction, invariants, and when *not* to reuse it:

| | |
|---|---|
| [`core/README.md`](core/README.md) | Project-404 Core as a whole — the Core ↔ product boundary |
| `core/contracts/` · `core/kernel/` · `core/events/` | the foundation layer |
| `core/identity/` · `core/rbac/` · `core/organizations/` | auth & access |
| `core/files/` · `core/audit/` · `core/notifications/` | capabilities |
| [`core/assistant/README.md`](core/assistant/README.md) | AI Copilot orchestration — the one capability shared by both products (§ Rule of Three) |
| `core/localization/` · `core/observability/` · `core/http/` · `core/bootstrap/` | cross-cutting |
| [`mizan/README.md`](mizan/README.md) · [`mizan/backend/app/README.md`](mizan/backend/app/README.md) | **Mizan** (Project #1) — the Core ↔ Mizan boundary |
| [`mizan/web/README.md`](mizan/web/README.md) | **Mizan** web client — API-only, imports no repo code |
| [`mizan/mobile/README.md`](mizan/mobile/README.md) · [`mizan/mobile/PROJECT_OVERVIEW.md`](mizan/mobile/PROJECT_OVERVIEW.md) | **Mizan** mobile client (Expo / RN) — API-only, imports no repo code |
| [`docs/atlas-assistant.md`](docs/atlas-assistant.md) | **Atlas** (Project #2) Copilot — the product-specific layer on `core/assistant`. Atlas has no per-module READMEs yet (that pass hasn't been done, unlike Mizan/Core) — this doc plus the code comments in `atlas/backend/app/realestate/assistant/` are the closest thing today. |

### Docs

| Doc | Scope |
|---|---|
| [`Plan.md`](Plan.md) | the Project-404 constitution / governing rules |
| [`docs/system-architecture.md`](docs/system-architecture.md) | the canonical destination vision (50 sections) |
| [`docs/mizan-project-one.md`](docs/mizan-project-one.md) | **Mizan = Project #1** — physical layout, the authoritative Core ↔ Mizan boundary, why there is no `modules/` / `client-00N/` yet |
| [`docs/architecture.md`](docs/architecture.md) | Core v0.1 as-built |
| [`docs/tenancy.md`](docs/tenancy.md) | the multi-tenancy design + rollout |
| [`docs/integration-guide.md`](docs/integration-guide.md) | building a client project on Core |
| [`docs/conventions.md`](docs/conventions.md) | code conventions |
| [`docs/engineering-overview.md`](docs/engineering-overview.md) | one-file synthesis of the whole system |
| [`docs/database-erd.md`](docs/database-erd.md) | the schema as a Mermaid ER diagram |

---

## License

MIT — see [`LICENSE`](LICENSE).
