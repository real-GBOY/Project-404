# AURIC + Mizan — build fact sheet

Raw material for a write-up / LinkedIn post. Everything here is pulled from the
repo (`README.md`, `docs/`, `prisma/schema/`, test suites) — no rounding up.

---

## 1. The one-liner

**AURIC** is a domain-agnostic application foundation. **Mizan** (codename
*Project 404*) is the first real product built on it — a multi-tenant law-firm
management system (ERP) for an Egyptian firm.

The bet: the *next* client after Mizan never re-implements auth, tenancy,
permissions, file storage, an audit trail, or an event system. That's the whole
point of the seam between `core/` and `mizan/`.

> AURIC is not a law-firm ERP. It's the foundation. Mizan is the ERP, *powered by* AURIC Core.

---

## 2. Architecture — one repo, one hard seam

The whole system, one picture:

```
 ONE-WAY DEPENDENCY —  AURIC CORE ◀── MIZAN BACKEND ◀── CLIENTS  ·  core never imports mizan
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ CLIENTS                                          permission-aware UI from /api/me │
 │   mizan/web    — React 19 · Vite · Tailwind v4 · TanStack Query · i18next (AR, RTL) │
 │   mizan/mobile — React Native (Phase 2)                                         │
 └───────────────────────────────────────────────────────────────────────────────┘
             │  HTTP / JSON only — clients share zero code with the server
             ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ MIZAN BACKEND   mizan/backend/app/lawfirm/   ·   NestJS 11 on Fastify · SWC     │
 │   matters · hearings · tasks · documents · billing · clients · staff ·         │
 │   calendar · dashboard · settings · activity                                   │
 │   every module: domain / application / infrastructure / api / events /         │
 │                 permissions / validation / tests                               │
 │  » each feature proves Tenant A ⊗ Tenant B isolation before it lands           │
 └───────────────────────────────────────────────────────────────────────────────┘
             │  core/contracts — the entire surface between the two halves (+ DI tokens)
             ▼   IUserProvider · IPermissionProvider · ITenantContext ·
                 IFileStorage · IAuditLogger · IEventBus
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ AURIC CORE   core/   — knows nothing about law firms · versioned, reusable      │
 │   identity · rbac · organizations · tenancy · files · audit · notifications ·  │
 │   events · localization · observability · http                                 │
 │  » transactional outbox — state change + event row in ONE transaction →        │
 │    worker delivers → dead-letter queue on failure                              │
 │  » append-only audit trail (DB trigger) · bilingual AR/EN · Argon2id + refresh │
 └───────────────────────────────────────────────────────────────────────────────┘
             │  Kysely — typed SQL, no ORM   ·   Prisma — owns schema + 5 migrations,
             ▼  generates Kysely's types (no Prisma Client)
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ POSTGRESQL   — the security boundary                                           │
 │   row-level security · organization_id NOT NULL on every tenant table ·        │
 │   SET LOCAL app.organization_id per transaction                                │
 │   auric_app (NOBYPASSRLS) → requests   |   auric_system (BYPASSRLS) → worker    │
 │   + local disk (files) · SMTP (mail) — swappable adapters, one process         │
 └───────────────────────────────────────────────────────────────────────────────┘
```

- `core/` **must never** import from `mizan/`. Enforced + verified: `grep -rn "mizan/" core/` is empty. If a Core symbol names a `Matter`, a `Hearing`, or an `Invoice`, it's in the wrong layer.
- `mizan/backend/` touches Core **only** through `core/contracts` interfaces and DI tokens — never a Core table or concrete class. One sanctioned exception: the boot-time seed.
- `mizan/web/` imports **no repository / server code at all**. It consumes the HTTP API and re-implements the few shared rules (the `action:resource` permission matcher, the `ar-EG` formatters).
- It's a **modular monolith**, not microservices: one NestJS process, feature `@Module`s, clean layer boundaries, no network hops between domains.

Every module — Core or Mizan — follows the **same anatomy**:
`domain / application / infrastructure / api / events / permissions / validation / tests`.
Any developer can navigate any module.

---

## 3. Principles the code actually enforces

| Principle | How it shows up in the code |
|---|---|
| **The database is the security boundary** | Postgres row-level security + `organization_id NOT NULL` on every tenant table. A forgotten `WHERE` clause in application code *cannot* leak across tenants. Frontend `can()` is UX only. |
| **Rule of Three** | No capability is extracted into a reusable AURIC module until it's been built across **three** real client projects. Mizan is client #1 — nothing is extracted yet. |
| **Every use case owns its transaction** | Fixed shape: `authenticate → validate → transaction → persist → publish event`. The event bus never opens a transaction. |
| **Prisma owns schema, Kysely owns runtime** | Prisma defines tables + migration history and *generates Kysely's types*. No Prisma Client, no ORM at runtime — typed SQL only. |
| **Money is never summed across currencies** | Financial values are `{ currency, amount }[]`, rendered as stacked lines. No FX, no "dominant currency". Invoice math is server-authoritative. |
| **Arabic-first** | AR is the default language, RTL is first-class (logical CSS only), `ar-EG` number / date / currency formatting, bilingual notification templates. |
| **Isolation proven per module** | Each backend feature proves **Tenant A ⊗ Tenant B** isolation in an integration test before it lands. |

---

## 4. Multi-tenancy (the part worth bragging about)

- An **organization is the tenant.** Global identity (one user, many orgs), shared schema, one Postgres database.
- Every tenant-scoped table: `organization_id NOT NULL`.
- Per-transaction `SET LOCAL app.organization_id = …`; application queries run as a **`NOBYPASSRLS`** role (`auric_app`), the background worker as a separate **`BYPASSRLS`** role (`auric_system`).
- **Postgres RLS is the backstop**, not a nicety: policies enforce both read scoping and `WITH CHECK` containment (you can't INSERT a row into someone else's tenant).
- Integration-tested against a throwaway Postgres for: cross-tenant read leakage, `WITH CHECK` containment, and per-tenant outbox delivery.
- Design write-up: `docs/tenancy.md`.

---

## 5. The data model

Generated from `prisma/schema/*.prisma`. Interactive map: **Mizan Schema Map** (Claude artifact).

| Metric | Value |
|---|---|
| Tables | **34** |
| Modules | **16** (7 Core platform · 9 law-firm domain) |
| Core-platform tables | 15 |
| Law-firm domain tables | 19 |
| Declared foreign keys | 26 |
| Tables with **no FK by design** | 9 (audit trail, files, outbox/DLQ, activity feed, settings, staff — must outlive an org/user deletion, or cross a module boundary) |
| Prisma schema files | 17 (16 model files, split by module) |
| Migrations | 5 (`baseline` → `constraints/triggers/indexes` → `multitenancy columns` → `multitenancy RLS` → `lawfirm`) |
| Composite `(organization_id, id)` FKs on tenant tables | yes — FKs can't cross tenants |

**Constraints Prisma's schema language can't express — written as raw SQL in migrations:**
- `audit_logs` immutability trigger (no `UPDATE` / `DELETE`, ever)
- `outbox_messages` partial index (`WHERE status = 'pending'`) + status `CHECK` constraint

**Core modules:** identity, organizations, rbac, notifications, audit, events (outbox), files
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

---

## 7. Stack

**Backend**
TypeScript · Node 22.12+ / 24 · PostgreSQL only ·
**NestJS 11 on `@nestjs/platform-fastify`** (Fastify 5) · SWC at runtime for dev/tests, `tsc` for the production build (both emit decorator metadata — esbuild can't) ·
**Kysely** (typed query builder, no ORM) · **Prisma** (schema + migrations only — no Prisma Client) ·
Zod · `@nestjs/swagger` (`/api/docs`) · `jsonwebtoken` + `argon2` (argon2id) · `nodemailer` · `pino` · **Vitest** · ESLint 9 + Prettier.

**Frontend**
Vite 6 · React 19 · TypeScript · Tailwind v4 (semantic tokens) · Radix · TanStack Query v5 · React Router v7 · react-hook-form + Zod · **i18next** (Arabic default + RTL) · MSW (tests only).

**Ops**
Multi-stage `Dockerfile` (non-root, healthcheck) · `docker compose up --build` (one command: Postgres + migrate + provision RLS roles + seed + serve) · **GitHub Actions CI** — typecheck · lint · format · test-with-Postgres · build · image build, on every push/PR.

**DI:** symbol tokens in `core/kernel/tokens.ts` — no string tokens, no magic.

---

## 8. Tests

| Suite | Count |
|---|---|
| Backend (Core + Mizan) | **124** tests across 18 files |
| Web | **78** tests across 29 files |
| **Total** | **202** tests, green |

Backend includes integration suites that **boot the real app against a throwaway Postgres** — RLS, cross-tenant leakage, `WITH CHECK` containment, per-tenant outbox delivery. The harness runs the app as `auric_app` / `auric_system` so `FORCE ROW LEVEL SECURITY` is actually exercised.
Everything runs in CI on every push/PR (`typecheck · lint · format:check · test · build` for both packages, plus the Docker image).

---

## 9. Hard things done deliberately

- **Transactional outbox + dead-letter queue + backlog health check** — events are written in the same transaction as the state change; a worker delivers them; failures land in a DLQ with retry history, not `console.error`.
- **Append-only audit trail enforced by a database trigger** — not by "we promise not to call UPDATE".
- **Prisma → Kysely type flow** — one schema definition, migrations from Prisma, but every runtime query is typed SQL through Kysely. No ORM lazy-loading surprises, no N+1 by accident.
- **Server-authoritative money** — invoice totals (fees + disbursements + VAT − payments), per-currency, no FX. The client renders what the server computed.
- **Arabic-first, not Arabic-added** — RTL via logical CSS properties only, `ar-EG` `Intl` formatters, bilingual templates seeded on boot.
- **Started from a Claude Design prototype** → 18 locked architecture decisions → backend-first, isolation-tested per module.

---

## 10. Numbers, for a punchy line

- **1** foundation, **1** product, **1** hard seam, **0** imports from `mizan/` into `core/`
- **34** tables · **16** modules · **26** foreign keys · **5** migrations
- **202** tests green (124 backend / 78 web)
- **213** frontend source files · **13** feature areas (F0–F16) · **~37** restyled UI primitives
- **11** Core capabilities shipped at v0.1 · **11** law-firm feature modules
- **2** Postgres roles (`auric_app` NOBYPASSRLS / `auric_system` BYPASSRLS) — the tenancy backstop
- Multi-tenant SaaS on **1** shared Postgres schema, isolation enforced by the database

---

## 11. Pointers

- `README.md` — the canonical overview
- `docs/system-architecture.md` — the full vision + rules
- `docs/mizan-project-one.md` — the Core ⇄ Mizan contract, why there's no `modules/` folder yet
- `docs/tenancy.md` — the multi-tenancy design
- `docs/database-erd.md` — the schema, as Mermaid
- **Mizan Schema Map** — the interactive schema + demo-data artifact
