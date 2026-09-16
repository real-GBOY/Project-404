# AURIC + Mizan + Atlas — build fact sheet

Raw material for a write-up / LinkedIn post. Everything here is pulled from the
repo (`README.md`, `docs/`, `prisma/schema/`, test suites) — no rounding up.

---

## 1. The one-liner

**AURIC** (codename *Project 404*) is a domain-agnostic application
foundation. **Mizan** is the first real product built on it — a multi-tenant
law-firm management system (ERP) for an Egyptian firm. **Atlas** is the
second — a real-estate developer OS (CRM, inventory, sales, payment plans,
finance) for an Egyptian property developer.

The bet: the *next* client after Mizan never re-implements auth, tenancy,
permissions, file storage, an audit trail, or an event system. Atlas is that
bet, tested for real — a second, independently-deployed product (own package,
own database) built on the same `core/`, in a different domain, to find out
which parts of the foundation were actually reusable and which were quietly
Mizan-shaped.

> AURIC is not a law-firm ERP, and it isn't a real-estate OS. It's the foundation. Mizan and Atlas are the products, both *powered by* AURIC Core.

---

## 2. Architecture — one hard seam, repeated for a second product

The whole system, one picture:

```
 ONE-WAY DEPENDENCY —  AURIC CORE ◀── { MIZAN BACKEND, ATLAS BACKEND } ◀── CLIENTS
 core never imports mizan/ or atlas/  ·  the two backends never import each other
 ┌────────────────────────────────────┐   ┌────────────────────────────────────┐
 │ MIZAN CLIENTS   /api/me-driven UI   │   │ ATLAS CLIENTS   /api/me-driven UI   │
 │   mizan/web  — React 19 · Tailwind v4 │   │   atlas/web — React 19 · Tailwind 4 │
 │   mizan/mobile — React Native       │   │   (own dev server, own database)    │
 └────────────────────────────────────┘   └────────────────────────────────────┘
             │  HTTP / JSON only                        │  HTTP / JSON only
             ▼                                           ▼
 ┌────────────────────────────────────┐   ┌────────────────────────────────────┐
 │ MIZAN BACKEND  @auric/core :3000    │   │ ATLAS BACKEND  @atlas/backend :3100 │
 │ mizan/backend/app/lawfirm/          │   │ atlas/backend/app/realestate/       │
 │  matters · hearings · tasks ·       │   │  crm · properties · sales · finance │
 │  documents · billing · clients ·    │   │  · operations · admin · dashboard   │
 │  staff · calendar · activity        │   │  · assistant (AI Copilot)           │
 │ » proves Tenant A ⊗ Tenant B        │   │ » own package.json, own Prisma      │
 │   isolation before a feature lands  │   │   migration history, own database   │
 └────────────────────────────────────┘   └────────────────────────────────────┘
             │        core/contracts — the entire surface between either backend and Core
             ▼        IUserProvider · IPermissionProvider · ITenantContext ·
                      IFileStorage · IAuditLogger · IEventBus
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ AURIC CORE   core/   — knows nothing about law firms or real estate · reusable  │
 │   identity · rbac · organizations · tenancy · files · audit · notifications ·  │
 │   events · assistant (AI Copilot orchestration) · localization · observability │
 │   · http                                                                        │
 │  » transactional outbox — state change + event row in ONE transaction →        │
 │    worker delivers → dead-letter queue on failure                              │
 │  » append-only audit trail (DB trigger) · Argon2id + refresh · AI tool pipeline │
 │    gated by the same RBAC every HTTP request goes through                      │
 └───────────────────────────────────────────────────────────────────────────────┘
             │  Kysely — typed SQL, no ORM   ·   Prisma per package — owns schema + migrations,
             ▼  generates Kysely's types (no Prisma Client)
 ┌────────────────────────────────────┐   ┌────────────────────────────────────┐
 │ POSTGRES · auric  (Mizan + Core)    │   │ POSTGRES · atlas  (Atlas + Core)    │
 │  RLS · organization_id NOT NULL ·   │   │  same RLS discipline, a physically   │
 │  auric_app / auric_system roles     │   │  separate database — not a schema    │
 │  + local disk (files) · SMTP        │   │  inside Mizan's                      │
 └────────────────────────────────────┘   └────────────────────────────────────┘
```

- `core/` **must never** import from `mizan/` or `atlas/`. Enforced + verified: `grep -rn "mizan/\|atlas/" core/` is empty. If a Core symbol names a `Matter`, a `Hearing`, a `Lead`, or a `Unit`, it's in the wrong layer.
- `mizan/backend/` and `atlas/backend/` each touch Core **only** through `core/contracts` interfaces and DI tokens — never a Core table or concrete class. One sanctioned exception per product: the boot-time seed.
- `mizan/web/` and `atlas/web/` import **no repository / server code at all**. Each consumes its own product's HTTP API and re-implements the handful of shared rules (the `action:resource` permission matcher, formatting).
- Each product is a **modular monolith**, not microservices: one NestJS process per product, feature `@Module`s, clean layer boundaries, no network hops between domains. Two products means two processes and two databases — not a shared multi-tenant schema across domains.
- `atlas/backend` is a fully separate npm package (`@atlas/backend`), not a folder inside the root package — its own `package.json`, its own Prisma migration history, its own Postgres database. It reaches `core/` by importing the same source over a relative path alias, not by running inside the same process as Mizan.

Every module — Core, Mizan, or Atlas — follows the **same anatomy**:
`domain / application / infrastructure / api / events / permissions / validation / tests`.
Any developer can navigate any module.

---

## 3. Principles the code actually enforces

| Principle | How it shows up in the code |
|---|---|
| **The database is the security boundary** | Postgres row-level security + `organization_id NOT NULL` on every tenant table, in both products. A forgotten `WHERE` clause in application code *cannot* leak across tenants. Frontend `can()` is UX only. |
| **Rule of Three, with one earned exception** | No capability is extracted into a reusable AURIC module until it's been built across **three** real client projects. Mizan is client #1, Atlas is client #2 — Core stays put until a third shows up, except `core/assistant`: the AI-orchestration loop both products independently built the same way, pulled into Core at two rather than let a third copy it again. |
| **Every use case owns its transaction** | Fixed shape: `authenticate → validate → transaction → persist → publish event`. The event bus never opens a transaction. |
| **Prisma owns schema, Kysely owns runtime** | Prisma defines tables + migration history and *generates Kysely's types*. No Prisma Client, no ORM at runtime — typed SQL only. Each product owns its own Prisma history against its own database. |
| **Money is never summed across currencies** | Financial values are `{ currency, amount }[]`, rendered as stacked lines. No FX, no "dominant currency". Invoice and payment-plan math is server-authoritative in both products. |
| **Arabic-first (Mizan) / English-only by design (Atlas)** | Mizan: AR is the default language, RTL is first-class (logical CSS only), `ar-EG` formatting, bilingual notification templates. Atlas is a single-market internal tool for an Egyptian developer's own sales team — no localization was in scope. |
| **Isolation proven per module** | Each backend feature, in either product, proves **Tenant A ⊗ Tenant B** isolation in an integration test before it lands. |

---

## 4. Multi-tenancy (the part worth bragging about)

- An **organization is the tenant.** Global identity (one user, many orgs), shared schema *per product*, one Postgres database *per product* (Mizan's `auric`, Atlas's `atlas` — the tenancy model is per-product, not one mega-schema across domains).
- Every tenant-scoped table: `organization_id NOT NULL`, in both products.
- Per-transaction `SET LOCAL app.organization_id = …`; application queries run as a **`NOBYPASSRLS`** role (`auric_app`), the background worker as a separate **`BYPASSRLS`** role (`auric_system`) — same pattern, independently provisioned per database.
- **Postgres RLS is the backstop**, not a nicety: policies enforce both read scoping and `WITH CHECK` containment (you can't INSERT a row into someone else's tenant).
- Integration-tested against a throwaway Postgres for: cross-tenant read leakage, `WITH CHECK` containment, and per-tenant outbox delivery.
- Design write-up: `docs/tenancy.md`.

---

## 5. The data model

Generated from `prisma/schema/*.prisma` (Mizan + Core) and `atlas/backend/prisma/schema/*.prisma` (Atlas — its own, separate schema and migration history). Interactive map: **Mizan Schema Map** (Claude artifact).

| Metric | Mizan + Core | Atlas |
|---|---|---|
| Tables | **37** total (17 Core-platform + 20 law-firm domain) | **23** `realestate_*` tables, own database |
| Modules | 9 Core platform · 10 law-firm domain | 7 domain areas — crm · properties · sales · finance · operations · admin · assistant |
| Declared foreign keys | 28 | 9 |
| Prisma schema files | 19 (18 model files, split by module) | 7 model files |
| Migrations | 9 | 9 (own history — includes its own copy of the Core baseline + RLS migrations, since it's a separate database) |
| Composite `(organization_id, id)` FKs on tenant tables | yes — FKs can't cross tenants | yes, same pattern |

Core's 2 `ai_*` tables (`ai_conversations`, `ai_messages` — the shared AI Copilot conversation store) are counted once, in the Mizan + Core column; Atlas reuses the same tables in its own database via the same `core/assistant` code, not a shared row.

**Constraints Prisma's schema language can't express — written as raw SQL in migrations:**
- `audit_logs` immutability trigger (no `UPDATE` / `DELETE`, ever)
- `outbox_messages` partial index (`WHERE status = 'pending'`) + status `CHECK` constraint

**Core modules with tables:** identity, organizations, rbac, notifications, audit, events (outbox), files, assistant (`ai_conversations` / `ai_messages`)
**Law-firm modules:** settings, staff, crm (clients + contacts), matters, calendar (hearings + events), tasks, documents, billing (invoices + lines + payments + expenses), activity

---

## 6. What's built

### AURIC Core — `core/` ✅ v0.1 shipped

| Capability | State |
|---|---|
| Identity & auth — register / login / logout / refresh / email verification / password reset, **Argon2id**, refresh-token rotation | ✅ |
| RBAC — User / Role / Permission, `can(user, action, resource)`, wildcards, `action:resource` keys | ✅ |
| Organizations & membership — the org **is** the tenant | ✅ |
| Multi-tenancy — global identity, shared schema, `SET LOCAL` per transaction, Postgres RLS backstop | ✅ built + integration-tested |
| Files — upload / download / delete / metadata, RBAC-gated, swappable storage adapter (local disk) | ✅ |
| Audit — append-only trail, queryable, DB-enforced immutability | ✅ |
| Notifications — in-app + email, templated, bilingual AR/EN, delivered via the outbox | ✅ |
| Events — in-process bus + **transactional outbox** + worker + **dead-letter queue** + backlog health check | ✅ |
| Localization — language / direction resolution, `ar-EG` formatters | ✅ |
| Observability — structured logs (pino), correlation IDs, `/health`, `/health/ready` | ✅ |
| HTTP — Zod validation pipe, `JwtAuthGuard` + `PermissionGuard` + `@RequirePermission`, exception filter, request-context middleware | ✅ |
| **AI Copilot orchestration** — LLM provider boundary, RBAC-gated tool-execution pipeline, scope-gate (heuristic → classifier, fail-open), conversation store. Domain-agnostic — each product supplies its own tools, prompt, permission gates | ✅ the one capability pulled out before three products, proven under two real Copilots |

### Mizan backend — `mizan/backend/app/lawfirm/` ✅ domain complete

- Composition root + **two-layer seed** (Core platform permissions, then law-firm permissions + the roles `firm_admin · partner · lawyer · paralegal · finance · read_only`).
- A full set of law-firm permissions across 9 domains contributed into Core RBAC (`create:matter`, `void:invoice`, `record:payment`, `approve:expense`, …).
- Feature modules: matters, hearings, tasks, documents, billing, staff, clients, calendar, dashboard, settings, activity — each ships the full module anatomy and proves Tenant A ⊗ Tenant B isolation.
- Adapters for Core (admin / RBAC surface, notifications).
- Opt-in demo seeder (`MIZAN_SEED_DEMO=true`) — a full fictional firm: 7 staff, 7 clients, 10 matters, hearings, tasks, documents, 6 invoices with line items + payments + expenses, an activity feed.
- The backend serves the **entire** `mizan/web` contract.

### Mizan web — `mizan/web/` ✅ all screens complete, cut over to the real backend

`dashboard` · `clients` (+6 tabs) · `matters` (+7 tabs) · `hearings` · `tasks` · `documents` · `calendar` (month grid) · `billing` (invoices / payments / expenses, server-computed invoice detail) · `team` (utilisation) · `notifications` inbox · `settings` (7 sections — Users & roles → real `/api/rbac`, audit → real `/api/audit-logs`, locale switch) · "Ask Mizan" assistant

- **213** source files · ~**37** design-system primitives (Radix, fully restyled to Mizan tokens) · **13** feature areas.
- Permission-aware nav / actions / routes driven by the exact keys `/api/me` returns.
- Data cutover **done**: the web app talks only to the real backend; the mock layer (MSW) moved to `src/test/` and is Vitest-only — there is no in-browser mock anymore.
- Visual identity: **Court Navy / Brass / Paper**, Spectral + Public Sans + Amiri, balance-scale logo.

### Atlas backend — `atlas/backend/app/realestate/` ✅ complete, own package + database

A second, independently-deployed product on the same Core — `@atlas/backend`, own `package.json`, own Prisma migration history, own Postgres database (`atlas`).

- Feature modules: `crm · properties · sales · finance · operations · admin · dashboard · assistant` — 23 `realestate_*` tables covering leads → deals → reservations → contracts → payment plans → installments → payments, price lists, projects/buildings/units inventory, commissions, tasks/workflows/approvals.
- **Atlas Copilot** (`assistant/`) — the real-estate-specific layer on `core/assistant`: units/leads/reservations/collections tools, a likely-to-sell ranking tool, its own scope vocabulary and permission gates. Real Groq calls, not a scripted demo.
- **Backend-driven search and filtering** on every list screen — a hand-written SQL relevance-ranking algorithm (exact → prefix → word-boundary → substring, weighted across columns) instead of client-side `.includes()`; KPI tallies query the unfiltered dataset separately so they never silently shrink under a filter.
- Opt-in demo seeder (`ATLAS_SEED_DEMO=true`) — a fictional Egyptian developer's full portfolio: agents, projects, buildings, units, leads through signed contracts and payment plans.

### Atlas web — `atlas/web/` ✅ complete, on the real backend

`dashboard` · `leads/customers/activities/follow-ups` (CRM) · `projects/buildings/units/availability/pricing` (inventory) · `reservations/deals/contracts/commissions` (sales) · `payments/installments/collections/outstanding/financial-reports` (finance) · `tasks/workflows/approvals/documents` (ops) · `team/roles/audit` (admin) · AI Copilot

- **111** source files across **12** feature areas · all colors sourced from one file, enforced by a sync test.
- Every filter dropdown backed by a real Radix component and a real backend query param — not a styled `<select>` with client-derived options.
- Audited end-to-end before being shown externally, not just typechecked: a login-session race condition, a `NaN` on a detail page, and a duplicate-key bug in global search were all caught by re-testing the running app against known data, not by reading the diff.

---

## 7. Stack

**Backend** (both products — same stack, two independent deployments)
TypeScript · Node 22.12+ / 24 · PostgreSQL only ·
**NestJS 11 on `@nestjs/platform-fastify`** (Fastify 5) · SWC at runtime for dev/tests, `tsc` for the production build (both emit decorator metadata — esbuild can't) ·
**Kysely** (typed query builder, no ORM) · **Prisma** (schema + migrations only — no Prisma Client, one schema history per product) ·
Zod · `@nestjs/swagger` (`/api/docs`) · `jsonwebtoken` + `argon2` (argon2id) · `nodemailer` · `pino` · **Vitest** · ESLint 9 + Prettier.

**Frontend**
Mizan: Vite 6 · React 19 · TypeScript · Tailwind v4 · Radix · TanStack Query v5 · React Router v7 · react-hook-form + Zod · **i18next** (Arabic default + RTL) · MSW (tests only).
Atlas: Vite · React 19 · TypeScript · Tailwind 4 · Radix · TanStack Query v5 · React Router — English-only by design, no i18n layer.

**Ops**
Mizan: multi-stage `Dockerfile` (non-root, healthcheck) · `docker compose up --build` (one command: Postgres + migrate + provision RLS roles + seed + serve) · **GitHub Actions CI** — typecheck · lint · format · test-with-Postgres · build · image build, on every push/PR. Atlas runs the same checks by hand today; it isn't in `ci.yml` yet.

**DI:** symbol tokens in `core/kernel/tokens.ts` — no string tokens, no magic. Same convention in `atlas/backend`.

---

## 8. Tests

| Suite | Count |
|---|---|
| Mizan backend (Core + Mizan) | **124** tests across 18 files |
| Mizan web | **78** tests across 29 files |
| Atlas backend | **80** tests across 14 files |
| Atlas web | **5** tests across 2 files |
| **Total** | **287** tests, green (one Atlas integration test is flaky against the live Groq free-tier rate limit — a provider quota, not a code defect) |

Backend includes integration suites that **boot the real app against a throwaway Postgres** — RLS, cross-tenant leakage, `WITH CHECK` containment, per-tenant outbox delivery — for both products. Mizan's suite runs the app as `auric_app` / `auric_system` so `FORCE ROW LEVEL SECURITY` is actually exercised; Atlas's does the same against its own database. Atlas also has a live-provider integration suite that calls the real Groq API (not mocked) to prove tool-calling and scope-refusal actually work.
Mizan (`typecheck · lint · format:check · test · build` for both packages, plus the Docker image) runs in CI on every push/PR; Atlas is currently verified the same way by hand — see § 6.

---

## 9. Hard things done deliberately

- **Transactional outbox + dead-letter queue + backlog health check** — events are written in the same transaction as the state change; a worker delivers them; failures land in a DLQ with retry history, not `console.error`.
- **Append-only audit trail enforced by a database trigger** — not by "we promise not to call UPDATE".
- **Prisma → Kysely type flow** — one schema definition, migrations from Prisma, but every runtime query is typed SQL through Kysely. No ORM lazy-loading surprises, no N+1 by accident.
- **Server-authoritative money** — invoice totals (fees + disbursements + VAT − payments), per-currency, no FX. The client renders what the server computed.
- **Arabic-first, not Arabic-added** — RTL via logical CSS properties only, `ar-EG` `Intl` formatters, bilingual templates seeded on boot.
- **A second product instead of a second demo** — Atlas isn't a re-skin of Mizan; it's a structurally separate package, database, and domain, built specifically to pressure-test whether `core/`'s contracts hold for something that isn't a law firm. They did — no Core code branches on either domain.
- **A hand-written SQL relevance algorithm over `.includes()`** — Atlas's search (`atlas/backend/app/realestate/shared/search.ts`) scores exact match → prefix → word-boundary → substring, weighted across columns, entirely in the query itself — not a new search service, not a new dependency, just SQL that ranks instead of a client-side filter that merely matches.
- **Shipped only after re-testing the running app, not just the diff** — before Atlas went out the door, every list screen's search and filters were re-verified live against known data (not "it compiles"), which is how a login-session race condition, a `NaN` on a detail page, and a duplicate-key bug in global search got caught and fixed instead of shipped.
- **Started from a Claude Design prototype** → 18 locked architecture decisions → backend-first, isolation-tested per module. (Atlas followed the same discipline as its own second pass.)

---

## 10. Numbers, for a punchy line

- **1** foundation, **2** independently-deployed products, **1** hard seam repeated twice, **0** imports from `mizan/` or `atlas/` into `core/`
- Mizan + Core: **37** tables · **28** foreign keys · **9** migrations. Atlas: **23** tables of its own, own database, own migration history.
- **287** tests green across both products (124 + 78 Mizan / 80 + 5 Atlas)
- **213** Mizan-web + **111** Atlas-web source files · **25** combined feature areas
- **12** Core capabilities shipped at v0.1 (11 platform + AI Copilot orchestration) · **11** law-firm feature modules · **8** Atlas domain areas
- **2** Postgres roles (`auric_app` NOBYPASSRLS / `auric_system` BYPASSRLS) — the tenancy backstop, provisioned independently in each product's database
- **1** AI-orchestration engine (`core/assistant`), **2** independent Copilots built on it, **0** copy-pasted tool-execution loops the second time around

---

## 11. Pointers

- `README.md` — the canonical overview, now covering both products
- `docs/system-architecture.md` — the full vision + rules
- `docs/mizan-project-one.md` — the Core ⇄ Mizan contract, why there's no `modules/` folder yet
- `docs/atlas-assistant.md` — the Atlas Copilot, and the product-specific layer on `core/assistant`
- `core/assistant/README.md` — the shared AI-orchestration engine both Copilots run on
- `docs/tenancy.md` — the multi-tenancy design
- `docs/database-erd.md` — the schema, as Mermaid
- **Mizan Schema Map** — the interactive schema + demo-data artifact
