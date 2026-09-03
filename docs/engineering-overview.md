# AURIC + Mizan — Engineering Overview

**A detailed engineering description of the whole system.** Written for an engineer
joining the project. It consolidates `README.md`, `Plan.md`,
`docs/system-architecture.md`, `docs/architecture.md`, `docs/tenancy.md`,
`docs/conventions.md`, `docs/integration-guide.md`, `docs/mizan-project-one.md`,
`mizan/backend/app/README.md`, `mizan/web/ARCHITECTURE.md`, and the source tree.

Where this and an "as-built" doc disagree, the as-built docs and the code win —
this document is a synthesis, not a new source of truth.

---

## 1. Executive summary

This repository is **two systems with a hard seam between them**:

| | What it is | Rule |
|---|---|---|
| **`core/`** — AURIC Core | A domain-agnostic application platform: identity, RBAC, multi-tenancy, files, audit, notifications, an event/outbox system, localization, observability, HTTP plumbing. Versioned (`0.1.0`), reusable. Knows nothing about any business domain. | Must never import from `mizan/`. |
| **`mizan/`** — Mizan (codename *Project 404*) | A multi-tenant law-firm management system (ERP) for Tawfik & Partners. **Project #1** — the first real application built on Core, and the proof that Core's contracts hold under a real product. | Reaches Core only through `core/contracts` interfaces + DI tokens. |

The thesis: **the next client after Mizan does not re-implement auth, tenancy,
permissions, file storage, an audit trail, or an outbox.** That is the entire
reason the seam exists. AURIC is not a law-firm ERP; it is the foundation. Mizan
is the ERP, *powered by* AURIC Core.

Everything runs as **one process** — a NestJS modular monolith on the Fastify
adapter. `main.ts` at the repo root composes Core + the Mizan backend, migrates,
seeds, and serves `/api`.

---

## 2. The one-way dependency law

```
AURIC CORE  ◀──  MIZAN BACKEND  ◀──  { mizan/web , mizan/mobile }
```

Dependencies flow one way, and only one way.

- `core/` **must never** import from `mizan/`. Enforced and verified:
  `grep -rn "mizan/" core/` is empty. If a Core symbol names a `Matter`, a
  `Hearing`, or an `Invoice`, it is in the wrong layer.
- `mizan/backend/` touches Core **only** through `core/contracts` interfaces and
  DI tokens — never a Core table or concrete class. One sanctioned exception:
  the boot-time seed (`mizan/backend/app/seed.ts` imports `RbacRepository` +
  `parsePermissionKey` from `core/rbac` to register law-firm permissions; a
  composition-root concern, not a domain-module concern).
- `mizan/web/` imports **no repository or server code at all**. It consumes the
  HTTP API and *re-implements* the two things it needs from the backend: the
  `action:resource` permission matcher and the `ar-EG` `Intl` formatters.

### The four boundaries (keep them explicit)

1. **Core vs Mizan** — platform concepts vs law-firm concepts.
2. **Backend vs Clients** — repository code vs HTTP consumers.
3. **Domain vs Infrastructure** — business rules vs Postgres/HTTP/Nest.
4. **Shared UI vs Feature UI** — design-system primitives vs opinionated screens.

---

## 3. Architectural style

**Modular monolith, not microservices.** One deployable process, one Nest
application. Modules are *logical* boundaries — they never call each other
directly and never touch each other's tables. They communicate through the
provider interfaces in `core/contracts/`, bound to symbol tokens in
`core/kernel/tokens.ts`. There is no gateway service; every controller mounts
under the global `/api` prefix.

Split a module into a service only under real architectural pressure (independent
scaling / deployment / team ownership / failure isolation / resource isolation).
Absent that, the monolith is correct even at high traffic. The boundaries are
drawn so extraction is *possible* if ever forced — an optimization for a future
that may never arrive.

### The Rule of Three

No capability is extracted into a reusable AURIC module until it has been built
across **three** real, different client projects **and** its stable reusable
shape is visible. Mizan is client #1. Consequently:

- There is **no `modules/` directory** and none will be created yet.
- There are **no `client-002/` / `client-003/` folders** — each future client is
  its own repository, consuming AURIC Core as a versioned pinned package.
- There are **no `packages/contracts|ui|config|utils`** — introduced only when
  cross-client reuse is proven.
- A `mizan/backend/app/lawfirm/<area>/` folder being a clean, fully-anatomised
  module does **not** make it reusable. It is Client #1's domain, built properly.

Eventual extraction *candidates* (candidates, not promises): Documents, Tasks,
CRM/Clients, Billing, Approvals. **Stays client-specific regardless:** Matters,
Hearings, court/lawyer workflows, legal terminology.

### Non-negotiable rules (condensed from `system-architecture.md` §47)

1. Core stays domain-agnostic. 2. Mizan is a real product, not a generic ERP
template. 3. Mizan's backend domain lives in `mizan/backend/app/lawfirm/`.
4–5. No premature module library; Rule of Three before extraction.
6. Modular monolith. 7. Thin controllers. 8. Logic in domain/application layers.
9. Infrastructure implements interfaces. 10. **Backend authorization is
authoritative.** 11. Frontend permissions are UX, not security. 12. Tenant
isolation is enforced by the backend **and** PostgreSQL RLS. 13–16. Web + mobile
share the backend, may differ in UX, prefer shared API contracts over duplicated
types, never share DOM/RN components for reuse's sake. 17–19. No speculative
infrastructure or abstraction. 20. Every extraction into AURIC must be justified
by real repeated usage.

---

## 4. Repository structure

```
auric/                          npm package @auric/core, version 0.1.0
├── core/                        AURIC Foundation — reusable, versioned, domain-agnostic
│   ├── kernel/                  config · db (pg pools + Kysely + unit-of-work + migrate runner)
│   │                            · logging (pino + AsyncLocalStorage RequestContext) · tenant
│   │                            · ids · clock · errors · DI tokens
│   ├── contracts/               the provider interfaces every module is consumed through (§4 of Plan)
│   ├── events/                  in-process bus + outbox + worker + dead-letter queue
│   ├── identity/  rbac/  organizations/  audit/  files/  notifications/
│   │                            each: domain / application / infrastructure / api / events /
│   │                            permissions / validation / tests + <cap>.module.ts
│   ├── localization/            direction, locale negotiation, Translatable<T>, ar-EG formatters
│   ├── observability/           errors + AppExceptionFilter + HealthController
│   ├── http/                    Zod pipe, JwtAuthGuard, PermissionGuard, SecurityModule
│   ├── bootstrap/               SeedService (Core permissions + admin role + templates)
│   ├── app.module.ts            Core's OWN test-fixture root — NOT the running one
│   └── index.ts                 public surface: the feature @Modules, tokens, contracts, tenant helpers
│
├── mizan/                       Project #1 — the Mizan law-firm application
│   ├── backend/app/
│   │   ├── app.module.ts        the RUNNING composition root
│   │   ├── seed.ts              AppSeedService — the two-layer seed
│   │   ├── version.ts           product name / codename / version
│   │   └── lawfirm/             the law-firm domain (see §13)
│   ├── web/                     standalone Vite package "mizan-web" — HTTP API only, imports no repo code
│   └── mobile/                  Phase 2 (placeholder)
│
├── prisma/
│   ├── schema/                  17 files, split by module (16 model files + datasource.prisma)
│   └── migrations/              5 migrations, applied by `prisma migrate deploy`
├── scripts/                     migrate · provision-db (thin wrappers)
├── http/                        .http request files
├── docs/                        this file + the source docs it synthesizes
├── storage/                     local-disk file adapter root
└── main.ts  package.json  tsconfig.json  vitest.config.ts  prisma.config.ts
```

`main.ts`, all build config, `prisma/`, `scripts/`, `http/`, `storage/` stay at
the repo root — they serve Core and Mizan together. `mizan/web/` is fully
standalone (its own `tsconfig` / Vite config); nothing at the root references it.

---

## 5. How Mizan reaches Core — the contract surface

A domain module never writes `SELECT … FROM users`. It injects the interface it
needs **by symbol token, typed as the interface**:

| Token (`core/kernel/tokens.ts`) | Interface (`core/contracts`) | Used for |
|---|---|---|
| `USER_PROVIDER` | `IUserProvider` — `getUser`, `userExists` | resolve an actor, render "assigned to …" |
| `ORGANIZATION_PROVIDER` | `IOrganizationProvider` — `getOrganization`, `isMember`, `membershipsForUser` | membership checks, login tenant resolution |
| `TENANT_CONTEXT` | `ITenantContext` — `organizationId()` (throws if none), `organizationIdOrNull()` | the few paths that must name the tenant |
| `PERMISSION_PROVIDER` | `IPermissionProvider` — `can(userId, action, resource)`, `assignRole`, `permissionsFor` | gate every write; resolved within the active tenant |
| `NOTIFICATION_PROVIDER` | `INotificationProvider` — `send(payload)` | notify users of domain events |
| `FILE_STORAGE` | `IFileStorage` — `upload`, `getUrl`, `getContent`, `delete` | store document bytes |
| `AUDIT_LOGGER` | `IAuditLogger` — `record(entry)` | audit sensitive operations |
| `EVENT_BUS` | `IEventBus` — `publish(event)` | publish domain events |
| `UNIT_OF_WORK`, `CLOCK` | — | transactions, time |

`KernelModule` (config/clock/unit-of-work) and `SecurityModule` (guards +
identity/RBAC contracts) are `@Global()`. A module `exports` the token it
provides; the consumer `imports` the module. The identity ↔ organizations cycle
uses `forwardRef()` on both sides.

`ITenantContext` is deliberately a *separate* contract, not folded into
`IOrganizationProvider` — an organization *is* the tenant, and most modules never
touch tenant context because RLS + the `organization_id` column handle scoping.

---

## 6. Module anatomy

Every module — Core capability or Mizan feature — has the same shape, so any
developer can navigate any module:

```
<module>/
├── domain/          entities, value objects, business rules.
│                    NO NestJS, NO Fastify, NO Prisma, NO HTTP, NO Postgres.
├── application/     use cases (@Injectable). Each owns its transaction boundary:
│                    authenticate context → validate rules → transaction → persist → publish event
├── infrastructure/  repositories (@Injectable) + provider implementations + adapters.
│                    The ONLY code that references a table. Calls currentExecutor() —
│                    no executor argument in method signatures.
├── api/             thin @Controller. request → validate (Zod pipe) → guards → one use case → plain object.
│                    No business logic, no DB access.
├── events/          the events this module publishes + its subscribers
├── permissions/     PermissionDefinition[] contributed to RBAC, seeded on boot
├── validation/      Zod schemas
├── tests/           unit (next to code, no DB, no Nest) + integration (in tests/, real Postgres)
└── <module>.module.ts   the @Module wiring the above
```

Table schema does **not** live in the module folder — it lives in
`prisma/schema/<module>.prisma`.

### Layer responsibilities

- **Domain** — pure. Decides business outcomes (a new user is `pending`; a matter
  can/can't be closed). No framework imports.
- **Application** — orchestrates a use case and **owns the transaction**. Opens
  `unitOfWork.transaction()`, calls repositories + audit + `events.publish()`
  inside it, commits. Nothing threads a transaction handle around — repositories
  and the event bus read the ambient transaction via `currentExecutor()`
  (an `AsyncLocalStorage` set by `unitOfWork.transaction`).
- **Infrastructure** — the only code that knows Postgres. Kysely repositories,
  provider impls, the local-disk file adapter, the SMTP email channel.
- **API** — thin controllers. `@Body(ZodBody(schema))` validates,
  `@UseGuards(JwtAuthGuard, PermissionGuard)` + `@RequirePermission(action,
  resource)` authorize (a **live** RBAC check, not a token-claims read), the
  handler calls one use case and returns a plain object. A thrown `AppError` is
  mapped to a status code by the global `AppExceptionFilter`.

---

## 7. Request lifecycle, end to end

Example: `POST /api/auth/register`.

1. **`RequestContextMiddleware`** (before guards) binds an `AsyncLocalStorage`
   `RequestContext` carrying a correlation id (inbound `x-correlation-id` header
   or a fresh uuid) — every log line, audit row, and outbox message downstream
   carries it — and resolves AR/EN from `?locale` → `Accept-Language` → default,
   setting `Content-Language` + `X-Content-Direction` response headers.
2. **Controller** — `AuthController.register`, `@Body(ZodBody(registerSchema))`
   validates. This route is public (no `@UseGuards`). Guarded routes run
   `JwtAuthGuard` then `PermissionGuard` as `CanActivate` guards;
   `JwtAuthGuard` verifies the JWT, checks the `org` claim, and
   `patchContext({ userId, organizationId })`.
3. **Use case** — `IdentityService.register()` opens the transaction:
   - build `UserEntity` (domain decides `pending`)
   - `userRepository.insert()`
   - `auditLogger.record()` — same transaction
   - `eventBus.publish("user.registered")` — same transaction
   - issue an email-verification token,
     `publish("user.email_verification_requested")`
4. **Commit.** The response travels back up.

The `RequestContext` is pushed into Postgres **per transaction**, inside
`unitOfWork.transaction`, immediately after the transaction opens:

```ts
const ctx = getContext();
if (ctx && !ctx.system) {
  if (!ctx.organizationId) throw new Internal("tenant-scoped transaction without an organization context");
  await sql`select
    set_config('app.organization_id', ${ctx.organizationId}, true),
    set_config('app.user_id',         ${ctx.userId ?? ""},   true)`.execute(trx);
}
```

`set_config(_, _, true)` is `SET LOCAL` — scoped to the transaction, so it can
never bleed into the next pool checkout. (This is also why pgBouncer in
transaction-pooling mode is safe here; session-level `SET` would not be.)

---

## 8. Multi-tenancy

**AURIC Core is a shared multi-tenant SaaS. An organization *is* the tenant.**
`tenant_id` is `organization_id` everywhere — no second concept, no new column
name. Design of record: `docs/tenancy.md`.

### The model

```
users ─────────────< organization_members >───────────── organizations
(global identity;      (the tenancy link:                  (= the tenant)
 no organization_id;    user_id + organization_id +        every tenant-scoped
 email globally unique) membership_role)                   table hangs off
                                                           organization_id + RLS
```

| Table class | Examples | RLS |
|---|---|---|
| **Global** (no `organization_id`) | `users`, `refresh_tokens`, `verification_tokens`, `roles`, `permissions`, `role_permissions`, Prisma migration history | none |
| **Registry** (readable before a tenant is chosen, during login) | `organizations`, `organization_members` | special-cased policies keyed on `app.user_id` |
| **Tenant-scoped** (`organization_id` + RLS) | `user_roles`, `files`, `notifications`, `audit_logs`, `outbox_messages`, `dead_letter_messages`, **every `lawfirm_*` table** | `tenant_isolation` policy |

- Identity is **global** — one `users` row per human, email globally unique. A
  user can belong to many organizations.
- RBAC v1: `roles` / `permissions` / `role_permissions` stay **global**
  (system-defined). Only `user_roles` gains `organization_id`, so "Alice is admin
  in org A, viewer in org B" works. Per-tenant custom roles are a documented
  later extension.
- `notifications.organization_id` is **nullable** — account-level notifications
  (welcome, security, invitations) carry `NULL` and are visible in any tenant
  context. `audit_logs.organization_id` is **nullable** too — system actions
  (cron, the outbox worker, cross-tenant support) legitimately have no tenant.
- `files` also namespaces its storage key by org (`org_xxx/file_yyy`) for defence
  in depth.

### Row-Level Security — the backstop

A forgotten `WHERE organization_id = …` in Kysely code **cannot** leak across
tenants, because the database refuses to return or write the rows.

| Postgres role | Used by | RLS |
|---|---|---|
| `auric_owner` | migrations, integration-test schema reset | owns the tables |
| `auric_app` | the running application (`AURIC_APP_DATABASE_URL`) | **no `BYPASSRLS`** — fully subject to policies |
| `auric_system` | signup, provider webhooks, the outbox worker, support tooling | `BYPASSRLS` — a small, audited set of code paths |

Every scoped table gets `ENABLE` **and** `FORCE ROW LEVEL SECURITY`, so even the
owner is filtered in dev/test — leaks surface during development, not in
production. Policy shape:

```sql
CREATE POLICY tenant_isolation ON notifications
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
```

- `current_setting('app.organization_id', true)` — the `true` returns `NULL`
  instead of erroring when the setting is absent. `NULL = anything` is `NULL`, so
  **no rows match** when context is missing: the safe default is "see nothing".
- `WITH CHECK` is not optional — without it a bug could *write* a row tagged with
  another tenant's id.

### The one gotcha — the non-transaction read path

`currentExecutor()` returns the raw pool when not inside `unitOfWork.transaction`.
Under RLS a pooled connection with no `app.organization_id` set sees **nothing**.
**Rule: every tenant-scoped query runs inside `unitOfWork.transaction`, reads
included.** Lone reads use a thin `readInTenant(fn)` helper. The
`PermissionGuard` wraps its `can()` check in `readInTenant` for exactly this
reason.

### System context

Paths that legitimately cross or precede tenants run with `system: true` in
context (which skips the `SET LOCAL`) on a connection using `auric_system`:

- **Signup / create-organization** — no tenant exists yet. Any authenticated user
  may create an org and becomes its `owner` + tenant-scoped `admin`.
- **Provider webhooks** — the tenant is derived from the payload.
- **The outbox worker** — it iterates rows across all tenants and must
  `set_config('app.organization_id', <row.organization_id>, true)` **per message**
  before invoking that message's handlers.
- **Platform support tooling** — cross-tenant reads; every call is audited with
  `organization_id = NULL` + the target in `metadata`.

Platform-admin ("AURIC staff") is **not** a tenant role. It is a property of the
code path + the `auric_system` role — never a `*:*` grant inside a tenant.

### Tokens & tenant switching

- **Access token** — short-lived HS256 JWT. Claims include `sub`, `org` (nullable
  active tenant), and `perms` (the permission set *for that user in that org*).
  An orgless token is valid only on non-tenant routes (`/me`, list orgs, create
  org).
- **Refresh token** — global, no `org`. Opaque random string stored as a SHA-256
  hash; rotated on every use; the token family is revoked on reuse (theft
  detection).
- **Switching tenants = `POST /api/auth/refresh { organizationId }`.** Verifies
  the refresh token, verifies membership, mints an access token with that `org`
  and recomputed `perms`. No re-login.

---

## 9. Data layer

### Prisma owns the schema; Kysely owns the runtime

| Concern | Tool |
|---|---|
| Schema definition, migration history, generated types | **Prisma 7** (`prisma/schema/*.prisma`, `prisma/migrations/`). A runtime dependency because `core.migrate()` shells its CLI. |
| Type generation | **`prisma-kysely`** (dev only) writes `core/kernel/db/schema.ts` with `dbTypeName = "Database"`. `npm run db:generate`. Never hand-edit that file. |
| All runtime SQL + the transaction boundary | **Kysely** |
| Request validation + config parsing | **Zod** |

**Prisma Client is never generated.** Types flow Prisma → Kysely and nowhere
else. Columns Prisma can't type precisely (string-union CHECK columns, JSONB
payloads, `files.byte_size` as `number`) carry a `/// @kyselyType(...)`
annotation in the schema.

### Schema at a glance

- **34 tables**, across **16 modules** (7 Core platform + 9 law-firm domain).
- **17 Prisma schema files** — 16 model files split by module + `datasource.prisma`.
- **26 declared foreign keys**; **9 tables carry no FK by design** — the audit
  trail, file metadata, outbox/DLQ, the activity feed, settings, staff profiles —
  because they must outlive an organization or user deletion, or because the
  reference crosses a module boundary (`lawfirm_documents.file_id → files.id` is a
  plain reference, matching how Core keeps file metadata decoupled).
- Tenant tables use a **composite `(organization_id, id)` unique key**, and child
  tables carry a **composite FK to the parent** — so a child can never point at a
  parent in another tenant, enforced by the FK, not a trigger.
- Full ER diagram: `docs/database-erd.md` (Mermaid) + the *Mizan Schema Map*
  artifact.

### Constraints Prisma's schema language can't express

Hand-written into follow-up migrations (`…_constraints_triggers_indexes`):

- Six `CHECK` constraints.
- `auric_set_updated_at` trigger + its per-table triggers (`updated_at` is
  DB-maintained, never set by application code).
- The **`audit_logs` append-only trigger** — `UPDATE` / `DELETE` are blocked at
  the database.
- The `outbox_ready_idx` **partial index** (`WHERE status = 'pending'`).
- The RLS `ENABLE` / `FORCE` statements and every policy.

### Migrations

Five, applied by `prisma migrate deploy` (which `core/kernel/db/migrate.ts`
shells as a child process; called from `main.ts` before `NestFactory`):

1. `baseline` — the full v0.1 schema (generated by `prisma migrate diff`, with
   `CREATE EXTENSION citext` prepended).
2. `constraints_triggers_indexes` — the hand-written objects above.
3. `multitenancy_columns` — `organization_id` (nullable first) on the scoped
   tables + the new `user_roles` composite PK.
4. `multitenancy_rls` — `ENABLE` / `FORCE` RLS + policies on every scoped table +
   the two registry-table policies.
5. `lawfirm` — the 19 law-firm tables + their RLS.

Prisma rolls forward — there is no `migrate:down`.

### Conventions

- **Identifiers** — prefixed, k-sortable-ish random: `usr_…`, `org_…`, `role_…`,
  `mat_…`, `inv_…`, `obx_…`. Generated with `newId(prefix)`.
- **Time** — Core logic never calls `new Date()` / `Date.now()`. It takes a
  `Clock` and calls `clock.now()`. Tests inject `fixedClock()`.
- **JSONB** — plain objects pass straight through; **arrays and primitives must be
  `JSON.stringify`-ed** on write (node-postgres would coerce an array to a
  Postgres array literal otherwise).
- Repositories are the only code that names a table, and call `currentExecutor()`
  rather than taking an executor argument.

---

## 10. Events & the transactional outbox

`Plan.md` §6: choose delivery by *where the side effect lands*, not by importance.

| Handler touches… | Mechanism | Registered with |
|---|---|---|
| only the database | **in-process bus**, runs inside the publisher's transaction | `registry.onInProcess(event, handler)` |
| anything outside the DB (email, SMS, webhook, gateway) | **transactional outbox** → background worker with retries | `registry.onExternal(event, name, handler)` |

`EventBus.publish()`:

- runs in-process handlers **now**, on the caller's transaction — a throw rolls
  everything back, intentionally;
- if the event has **any** external subscriber, writes **one** `outbox_messages`
  row on the same transaction.

The bus **does not open or own a transaction**. The use case opens it; the bus
runs within that boundary.

### `OutboxWorker` (a DB-polling loop — no Redis in v0.1)

- Claims due rows with `FOR UPDATE SKIP LOCKED`, marks them `processing`.
- Runs the external handlers; on success → `delivered`.
- On failure → exponential backoff, back to `pending`, `attempts++`.
- At `max_attempts` (default 5) → the row is copied to `dead_letter_messages`
  with payload + error + full retry history, and the outbox row is marked
  `failed`. **Never silently dropped.**
- `releaseStale()` recovers rows a crashed worker left `processing`.
- Starts / stops via `OnApplicationBootstrap` / `OnApplicationShutdown`, gated by
  the `WORKER_AUTOSTART` token (`false` in tests, which drive `worker.tick()`
  directly and advance a `fixedClock` past backoff windows).

### Monitoring is mandatory

`GET /api/health/ready` reports the outbox backlog (`pending`, `processing`,
`failed`, `deadLettered`) and the worker's `lastTickAt` / `lastError`, and
returns **503** if the worker is stopped, erroring, badly backed up, or holds
**any** dead-lettered message.

Event conventions: name `<module>.<pastTenseAction>` (`user.registered`,
`matter.closed`); payloads versioned (`version: n`) and owned by the publishing
module; handlers must be idempotent.

---

## 11. Authentication & authorization

### Authentication (Core `identity`)

- Endpoints: register / login / logout / refresh / verify-email /
  forgot+reset-password.
- Passwords hashed with **Argon2id** (`argon2`).
- Access token: short-lived **HS256 JWT**.
- Refresh token: opaque random string, stored as a **SHA-256 hash**, **rotated on
  every use**, **family-revoked on reuse** (theft detection).
- Login is additive: `POST /auth/login` accepts an optional `organizationId`,
  resolving to that org (membership checked) → the sole membership → `null`. The
  response includes `organizations: [{ id, slug, name, membershipRole }]` for a
  tenant switcher.

### Authorization (Core `rbac`)

- Model: `User → Role → Permissions`. Permission keys are **`action:resource`**
  (`create:matter`, `void:invoice`, `read:organization`). `can()` supports `*`
  wildcards. Core seeds an `admin` role holding `*:*`.
- Permissions are **contributed by each module** (`permissions/` file) and
  registered on boot.
- **The backend is the security boundary.** `PermissionGuard` runs a **live** DB
  check on every guarded route (not a token-claims read), tenant-scoped via
  `readInTenant`. Frontend `can()` is UX only, and every frontend gate carries a
  comment saying so.
- Mizan roles seeded on top: `firm_admin`, `partner`, `lawyer`, `paralegal`,
  `finance`, `read_only`. **No domain code branches on a role key — only on
  permissions.**

---

## 12. AURIC Core — capability catalogue (v0.1, shipped)

| Module | What it provides |
|---|---|
| **kernel** | config (Zod-parsed env), `Clock`, `newId`, `AppError` + helpers, the pg pools (one per role), Kysely + `unitOfWork.transaction`, the migrate runner, pino logging with the `RequestContext` `AsyncLocalStorage` and correlation-id mixin, `tenant.ts` helpers. |
| **identity** | Users + refresh/verification tokens. Auth flows above. Owns `users`; every other module stores only a `userId` and reaches user data via `IUserProvider`. |
| **rbac** | `roles`, `permissions`, `role_permissions`, `user_roles`. `can(user, action, resource)` with wildcards. Seeds `admin` = `*:*`. |
| **organizations** | Org + members + JSON settings. The organization is the tenant; `organization_members` is the tenancy link; both tables are RLS-scoped with the special login-time policies. |
| **tenancy** (`kernel/tenant`) | `currentOrganizationId()`, `requireOrganizationId()`, `isSystemContext()`, `ITenantContext`. The `SET LOCAL` in `unitOfWork.transaction`. `runAsSystem()`. |
| **files** | `IFileStorage` (upload / getUrl / getContent / delete) + a local-disk adapter; an S3 adapter would need no use-case change. HTTP endpoints layer RBAC (`read:file` / `delete:file`) on top of owner access. Storage key namespaced by org. |
| **audit** | `IAuditLogger.record()`. Append-only — `UPDATE` / `DELETE` blocked by a DB trigger. No FK to `users` (must outlive deletion). Queryable. |
| **notifications** | `INotificationProvider.send()`. In-app rows written in the caller's transaction; email published as an event → outbox → worker. Bilingual AR/EN templates seeded on boot, overridable per client. |
| **events** | The in-process bus + transactional outbox + `OutboxWorker` + dead-letter queue + backlog health check (§10). |
| **localization** | `directionOf`, `negotiateLocale`, `Translatable<T>` (AR-first), `Intl`-based `ar-EG` / `en-EG` formatters (EGP, `Africa/Cairo`). Language / direction / formatting only — no integrations or compliance. |
| **observability** | pino structured logs, correlation IDs, a global `AppExceptionFilter` mapping `AppError.kind` → HTTP status, `HealthController` (`/api/health`, `/api/health/ready`). |
| **http** | The Zod validation pipe (`ZodBody`, `ZodQuery`), `JwtAuthGuard` + `PermissionGuard` + `@RequirePermission`, `@CurrentUser()`, `SecurityModule`, `RequestContextMiddleware`. |

`core/app.module.ts` exists **only** as the fixture for Core's own integration
tests. The running root is `mizan/backend/app/app.module.ts`.

---

## 13. The Mizan backend domain

`mizan/backend/app/lawfirm/` — one NestJS bounded module per law-firm feature.

### What Mizan owns

Law-firm concepts and their `lawfirm_*` tables: **Client, Contact, Matter,
Participant, MatterUpdate, Note, Hearing, Task, Document (metadata only), Invoice,
InvoiceLine, Payment, Expense, StaffProfile, CalendarEvent, LawFirmSettings,
activity entries, reminders.** The law-firm permission keys and the roles
`firm_admin … read_only`. All product copy and UX.

### What Mizan does NOT own

Anything in `core/` — identity, RBAC evaluation, organizations/tenancy, file
bytes, the audit trail, the notification pipeline, the event/outbox system. The
`mizan/web/` design-system primitives (Mizan's *web* concern). Reusable modules.

### Feature modules (each with the full anatomy)

`clients` · `matters` · `hearings` · `tasks` · `documents` · `billing` ·
`calendar` · `staff` · `dashboard` · `settings` — ten feature modules — plus
`admin` (an RBAC/audit surface adapter for Core), `activity` (wired through
`shared/`), and `demo` (an opt-in seeder). `shared/` holds cross-feature helpers:
`money.ts`, `roles.ts`, `rbac.ts`, `ids.ts`, directory lookups, common queries.

### The two-layer seed

`AppSeedService` runs on every boot, idempotently, in order:

| Layer | Owner | Seeds |
|---|---|---|
| Core seed (`SeedService`) | AURIC Foundation | platform permissions + `admin` wildcard role + Core notification templates |
| Mizan seed (`AppSeedService`) | this app | law-firm permissions (`create:matter`, `record:payment`, …) across 9 domains + the 6 roles |

So the platform has *N* permissions and Mizan adds *M* — never "AURIC has N+M".

### Domain invariants specific to Mizan

- Tenant isolation = `organization_id NOT NULL` + `tenant_isolation` RLS on every
  `lawfirm_*` table; child-table cross-tenant mismatch is blocked by a **composite
  FK to the parent**, not a trigger.
- **Financial calculation is server-authoritative:**
  `invoice total = fees + disbursements + VAT − payments`.
  `payment.currency` must equal `invoice.currency`. No overpayment past the
  balance. **Multi-currency has no FX** — values are `{ currency, amount }[]`,
  rendered as stacked lines, never summed across currencies.
- Every feature phase ships domain + use-case + repo/integration + API + authz +
  tenant-isolation + event/outbox tests, and proves **Tenant A ⊗ Tenant B**
  before it lands.

### Composition

```
main.ts → NestFactory.create(AppModule, new FastifyAdapter())
AppModule
  ├── Core modules   KernelModule · EventsModule · IdentityModule · RbacModule
  │                  OrganizationsModule · AuditModule · NotificationsModule · FilesModule
  └── LawfirmModule
        ├── LawfirmSharedModule
        ├── ClientsModule · MattersModule · HearingsModule · TasksModule
        ├── DocumentsModule · BillingModule · CalendarModule
        └── StaffModule · SettingsModule · DashboardModule · AdminModule
```

(`demo/` is a separate opt-in module; `activity/` is wired through `shared/`.)

### A representative use case

```ts
async close(actorId: string, matterId: string) {
  if (!(await this.perms.can(actorId, "close", "matter")))
    throw Forbidden("matter.forbidden", "You can't close matters.");

  return this.uow.transaction(async () => {
    const matter = await this.repo.get(matterId);          // RLS-scoped to the active tenant
    matter.close(this.clock.now());                        // domain rule
    await this.repo.update(matter);
    await this.audit.record({ actorId, action: "matter.closed", resourceType: "matter", resourceId: matterId });
    await this.events.publish(matterClosed({ matterId }));  // Core delivers side effects via the outbox
    return matter.toPublic();
  });
}
```

---

## 14. The Mizan web client

`mizan/web/` — a standalone Vite package. **Imports nothing from the repo**; the
HTTP API is the only interface.

### Stack

Vite 6 · React 19 · TypeScript · Tailwind v4 (semantic tokens) · Radix ·
TanStack Query v5 · React Router v7 · react-hook-form + Zod · **i18next**
(Arabic default, RTL first-class) · MSW (tests only).

### Dependency direction (hard rule)

```
app/            router + providers + layouts (composition root)
  ▼
features/<f>/   pages · components · hooks · api · schemas · types   (the Mizan domain)
  ▼
components/{ui,forms,tables,feedback,navigation}  +  lib/{api,auth,permissions,tenant,i18n,format}
  ▼
styles/ (tokens)
```

- A **feature never imports another feature.** Cross-feature need → lift into
  `lib/` or `components/`, or let the *route* compose both pages.
- `components/` imports only `lib/format`, `lib/i18n`, `styles`.
- `lib/` imports nothing from `features/` or `components/`.
- **Only `lib/api/*` knows URLs or calls `fetch`.**

### Feature anatomy

```
features/matters/
├── api/        typed fns (listMatters, getMatter, createMatter…) + a query-key factory
├── schemas/    zod — FORM validation only (no id/createdAt)
├── types/      API SHAPE only (server response contracts)
├── hooks/      useQuery / useMutation wrappers — the ONLY thing pages call for data
├── components/ feature-specific presentational components
├── pages/      route entry points; own the five states
└── index.ts    barrel — exports pages + route config only
```

`schemas/` and `types/` are kept separate on purpose — a form has no
`id`/`createdAt`; a response has no raw password.

### Data flow

```
Page → feature hook (useQuery/useMutation) → feature api fn → lib/api httpClient → HTTP
```

- Server data lives in the **TanStack Query cache only** — never copied into
  `useState`.
- `lib/api` `httpClient`: attaches `Authorization: Bearer`, on **401**
  single-flights `POST /api/auth/refresh` and retries once, maps non-2xx to a
  typed `ApiError`.
- `lib/auth`: `AuthProvider` bootstraps from `GET /api/me`; access token in
  memory, refresh token in `localStorage` (a noted hardening item).
- `lib/tenant`: active org decoded from the access token; `switchTo(id)` →
  refresh with `organizationId` → new token → refetch all.
- `lib/permissions`: `can("void:invoice")` against the exact backend key,
  wildcard-aware, mirrors `permissionMatches` in Core.
- `lib/format`: `formatMoneyList([{currency,amount}]) → string[]` — stacked
  lines, **never summed across currencies**.

### State ownership

| Kind | Home |
|---|---|
| Server data | TanStack Query cache (only) |
| Session / current user | `AuthProvider` context |
| Active organization | `TenantProvider` context |
| Permissions | derived from the token via `usePermissions()` |
| Filters, active tab, pagination | **URL search params** |
| Dialog open/closed, local toggles | `useState` |
| Form fields + validation | react-hook-form |

No Redux / Zustand.

### The five states — wired identically everywhere

`isPending` → skeleton (matching real row/card geometry) · `isError` →
`<ErrorState onRetry>` · empty → `<EmptyState>` (with a permission-gated action) ·
**403** → the route guard `<RequirePermission>` renders `<ForbiddenState>` ·
**404** → `<NotFoundPage>` (unknown URL) or `<NotFoundState>` (API 404 in a
detail page).

### The mock layer & cutover

`src/test/msw/` holds MSW handlers returning contract-shaped JSON. It is
**Vitest-only** — there is no in-browser mock any more. The web app talks only to
the real backend. Cutover per feature was: delete one handler file; the feature's
`api/` functions already targeted the real route, so nothing in
components/hooks/pages changed.

### Visual identity

Court Navy / Brass / Paper; Spectral + Public Sans + Amiri; a balance-scale logo.
~37 design-system primitives (Radix, fully restyled to Mizan tokens); no hex
values in components (Tailwind tokens / CSS vars only); logical CSS utilities only
(`ps-/pe-`, `ms-/me-`, `start-/end-`) so RTL is free.

---

## 15. Cross-cutting details

- **Errors** — throw `AppError` (or `ValidationError`, `NotFound`, `Conflict`,
  `Forbidden`, `Unauthenticated`, `Internal`) from any layer. Domain/application
  never import HTTP. `AppExceptionFilter` maps `kind` → status. Error `code` is
  machine-readable and namespaced (`identity.email_taken`, `rbac.role_not_found`).
- **Correlation id** — one id threads request → logs → DB rows → events →
  notifications, set by `RequestContextMiddleware` from `x-correlation-id` or a
  fresh uuid.
- **TypeScript** — ESM, `strict`, `verbatimModuleSyntax` (use `import type`; a
  DI-injected class must be a value import), `experimentalDecorators` +
  `emitDecoratorMetadata`. Relative imports are written **with** a `.js`
  extension. Module resolution `Bundler`.
- **Why SWC** — esbuild does not emit the decorator metadata Nest's DI needs.
  `@swc-node/register` for dev/serve, `unplugin-swc` for Vitest.
- **No runtime `console.*`** — use the logger.

---

## 16. Testing

| Level | Where | What |
|---|---|---|
| **Unit** | `*.test.ts` next to the code | no DB, no Nest — `new TheClass(stub)`. Domain rules, pure functions. |
| **Integration** | `core/tests/`, `mizan/backend/app/lawfirm/**/tests/` | gated on a test database URL. `createTestCore()` resets + migrates the schema **as `auric_owner`**, compiles `AppModule` **as `auric_app`** (so `FORCE ROW LEVEL SECURITY` is live), seeds, wires subscribers. `overrideProvider` swaps `CLOCK` / `EMAIL_CHANNEL` / `REQUIRE_EMAIL_VERIFICATION`. |
| **Tenant isolation** | integration | seed two orgs; as a member of org A a deliberately unscoped `select` returns **only** org A's rows; a write tagged org B is rejected by `WITH CHECK`; a query with no tenant context **throws** (not "returns everything", not "silently nothing"). |
| **Authorization** | integration | unauthorized action blocked; a permission change takes effect; RLS cannot be bypassed. |
| **Web** | Vitest (forks pool) + MSW | primitives (keyboard, focus, aria); hooks (`renderHook` — loading → data, error path, mutation invalidation); pages (assert each of the five states); `can()` unit tests incl. wildcards; e2e with Playwright. |

Test the outbox by calling `worker.tick()` and advancing a `fixedClock` — never
by sleeping.

**Current counts:** 124 backend tests / 78 web tests = **202 green**.

---

## 17. Build, run & CI

### Two ways to run

- **Docker** — `docker compose up --build` brings up Postgres, applies
  migrations, provisions the `auric_app` / `auric_system` roles, seeds a demo
  firm, and serves `/api` (+ `/api/docs`). The `Dockerfile` is multi-stage:
  `tsc` + `tsc-alias` build → prod-only `node_modules` + `dist/` in a
  non-root `node:24-slim` image with a `HEALTHCHECK`.
- **Local** — `npm run serve` (SWC at runtime) for dev; `npm run build`
  (`scripts/build.mjs` → `tsc -p tsconfig.build.json` + `tsc-alias`, then stage
  `prisma/` next to `dist/`) then `npm start` (`node dist/main.js`) for a
  compiled artifact.

### Boot sequence (`main.ts`)

```
getConfig()                              parse + validate env with Zod
  → migrateToLatest(databaseUrl)         child process: prisma migrate deploy
  → NestFactory.create(AppModule, FastifyAdapter({ bodyLimit: 1 MiB }))
  → app.register(@fastify/multipart)     25 MiB / 1 file
  → app.setGlobalPrefix("api")
  → app.enableShutdownHooks()
  → setupOpenApi(app)                    @nestjs/swagger → interactive docs at /api/docs
  → AppSeedService.seed()                Core permissions + templates, then law-firm permissions + roles
  → app.listen(port, "0.0.0.0")          the OutboxWorker starts via OnApplicationBootstrap
```

### CI (`.github/workflows/ci.yml`, every push + PR)

- **backend** — `npm ci` → `typecheck` → `lint` (ESLint 9) → `format:check`
  (Prettier) → `test` against a Postgres service (RLS enforced) → `build`.
- **web** — `lint` → `typecheck` → `test` → `build`.
- **docker** — the production image builds (buildx + GHA cache).

### Runtime

- **Node** `^22.12 || >=24` (Prisma won't install on odd majors like 23.x).
- **PostgreSQL only** — no secondary datastore, no Redis in v0.1.
- Three connection strings: `AURIC_DATABASE_URL` (owner — migrations + tests),
  `AURIC_APP_DATABASE_URL` (`auric_app`), `AURIC_SYSTEM_DATABASE_URL`
  (`auric_system`). The two role URLs fall back to the owner when unset.

### Key dependency versions

NestJS 11 · `@nestjs/platform-fastify` (Fastify 5) · `@nestjs/swagger` 11 ·
Kysely 0.29 · Prisma 7 · `prisma-kysely` 3 · Zod 3 · `jsonwebtoken` 9 ·
`argon2` 0.41 · `nodemailer` 9 · `pino` 9 · `pg` 8 · Vitest 3 · ESLint 9 ·
Prettier 3.

---

## 18. Current state, in numbers

| | |
|---|---|
| DB tables | 34 (15 Core platform · 19 law-firm) |
| Modules | 16 (7 Core · 9 law-firm) |
| Foreign keys / no-FK-by-design | 26 / 9 |
| Migrations | 5 |
| Core capabilities shipped (v0.1) | 11 |
| Mizan feature modules | 10 (+ `admin`, `activity`, `demo`) |
| Backend tests | 124 |
| Web tests | 78 (213 source files, 13 feature areas, F0–F16) |
| `core/` ← `mizan/` imports | 0 |
| Runtime processes | 1 |
| Datastores | 1 (PostgreSQL) |

---

## 19. Deliberately deferred

Each waits for a real requirement — the parts above are the ones expensive to
retrofit; these are not:

- Workflow / approval engine, reporting skeleton.
- SMS / push notifications, WebSockets, 2FA / OAuth.
- File thumbnails / virus scan / versioning.
- Metrics / alerting beyond `/api/health/ready`.
- Per-tenant custom roles + role UIs, tenant settings / theming / branding.
- Plan & quota enforcement, per-tenant rate limiting.
- Tenant suspend / export / delete flows.
- DB-per-tenant premium tier.
- API versioning (`/api/v1`) — arrives with a second client or a breaking change.
- Redis — arrives with the first real background job that needs a queue.
- `packages/contracts` for shared web/backend types — arrives with cross-client reuse.
- `mizan/mobile` — Phase 2.
- Extraction of any reusable module — Phase 4, after two more real client builds.

---

## 20. Document map

| Doc | Scope |
|---|---|
| `README.md` | clone & run; per-module contract index |
| `Plan.md` | the AURIC constitution / governing rules |
| `docs/system-architecture.md` | the canonical destination vision (20 non-negotiable rules) |
| `docs/architecture.md` | Core v0.1 as-built |
| `docs/tenancy.md` | the multi-tenancy design of record |
| `docs/integration-guide.md` | building a client project on Core; adding a module |
| `docs/conventions.md` | code conventions (TS, Nest, DB, events, HTTP, tests) |
| `docs/mizan-project-one.md` | the Core ↔ Mizan boundary; why there's no `modules/` yet |
| `docs/database-erd.md` | the schema as Mermaid |
| **`docs/engineering-overview.md`** | **this file — the synthesis** |
| `core/README.md` + `core/*/README.md` | per-capability architectural contracts |
| `mizan/backend/app/README.md` | Mizan backend contract + boundary |
| `mizan/web/README.md` · `ARCHITECTURE.md` · `PLAN.md` | Mizan web |
| `SHOWCASE.md` | build fact sheet (numbers, ASCII architecture) |
