# AURIC Core — Architecture (v0.1)

This describes what was actually built. It implements the decisions in
[`../Plan.md`](../Plan.md) sections 3–6; read that first for the *why*.

**Stack note (Plan §2).** HTTP, DI, and module wiring are **NestJS** on the
`@nestjs/platform-fastify` adapter (Fastify 5 underneath). Every class is an
`@Injectable` provider; each Core capability is a `@Module`; `core/app.module.ts`
is the composition root and `main.ts` the entrypoint. TypeScript compiles under
**SWC** (`@swc-node/register` for dev, `unplugin-swc` for Vitest) because esbuild
does not emit the decorator metadata Nest's DI needs. Runtime SQL and the
transaction boundary are Kysely. **Prisma owns the schema definition and the
migration history**, with types flowing Prisma → Kysely (Prisma Client is never
generated): `prisma/schema/*.prisma` models mirror every table, `prisma-kysely`
generates `core/kernel/db/schema.ts` (`npm run db:generate`), and
`prisma/migrations/` is applied by `prisma migrate deploy` —
`core/kernel/db/migrate.ts` shells that, called from `main.ts`. Objects Prisma
can't express (CHECK constraints, the `updated_at` and audit-immutability
triggers, the outbox partial index, the RLS policies) live in hand-written
follow-up migrations. See `integration-guide.md` and `prisma/README.md`.

## Shape: modular monolith

One deployable process — one Nest application. Modules are logical boundaries,
not services. They never call each other directly and never touch each other's
tables — they talk through the provider interfaces in `core/contracts/`, bound
to DI tokens in `core/kernel/tokens.ts` (Plan §4). Every module's controllers
mount under the `/api` global prefix; there is no gateway service.

```
HTTP (Nest on Fastify)  ─ RequestContextMiddleware: correlation-id → locale
      │
      ▼  /api  (each Core capability = one @Module + controller)
  health · identity · rbac · organizations · audit · files · notifications
      │
      ▼  each controller: ZodBody/Query pipe → JwtAuthGuard + PermissionGuard → call a use case
APPLICATION  use-case (@Injectable) owns the transaction; publishes events inside it
      │
      ▼
DOMAIN  entities + rules (no SQL, no HTTP, no Nest)
      │
      ▼
INFRASTRUCTURE  repositories (@Injectable; the only code that knows Postgres) via Kysely
      │
      ▼
PostgreSQL
```

## The request lifecycle (Plan §3.4), concretely

`POST /api/auth/register`:

1. `RequestContextMiddleware` (runs before guards) binds an `AsyncLocalStorage`
   context (`enterContext`) with the request id (inbound `x-correlation-id`
   header or a fresh uuid) — every log line, audit row and outbox message
   downstream carries it — and resolves AR/EN from `?locale` → `Accept-Language`
   → default, setting `Content-Language` + `X-Content-Direction`.
2. `AuthController.register` — `@Body(ZodBody(registerSchema))` validates the
   body. This route has no `@UseGuards` (registration is public). Guarded routes
   run `JwtAuthGuard` then `PermissionGuard` (a **live** RBAC check) as
   `CanActivate` guards.
3. `IdentityService.register()` — **the use case owns the transaction**:
   `unitOfWork.transaction(async () => { … })`.
   - build `UserEntity` (domain decides: new user is `pending`)
   - `userRepository.insert()`
   - `auditLogger.record()` — same transaction
   - `eventBus.publish("user.registered")` — same transaction
   - issue an email-verification token, `publish("user.email_verification_requested")`
4. Commit. Response travels back up. Frontend shows the created user.

Nothing threads a transaction handle around: repositories and the event bus
read the ambient transaction via `currentExecutor()` (an `AsyncLocalStorage`
set by `unitOfWork.transaction`). This is the Plan's "the bus merely runs
inside the transaction the caller controls."

## Multi-tenancy (Plan §7.3, docs/tenancy.md)

AURIC Core is a shared multi-tenant SaaS. **An organization is the tenant.**

- Every tenant-scoped table carries `organization_id`; **PostgreSQL row-level
  security** is the backstop — a forgotten `WHERE` in Kysely code cannot leak
  across tenants. `user_roles` and `files` are strict; `audit_logs`,
  `notifications`, and the outbox allow `NULL` for account-level / system rows.
- Two runtime roles: `auric_app` (no `BYPASSRLS`) for request work, `auric_system`
  (`BYPASSRLS`) for signup, provider webhooks, and the outbox worker.
  `pool.ts` keeps a pool per role; `unitOfWork.transaction` routes by
  `ctx.system` and, on the app connection, runs `SET LOCAL app.organization_id /
  app.user_id` so the policies resolve.
- The tenant rides the **`RequestContext`** (`logging/context.ts`) — one
  `AsyncLocalStorage`, shared with the correlation id. `JwtAuthGuard` sets it
  from the JWT `org` claim. `kernel/tenant.ts` exposes `currentOrganizationId()`
  / `requireOrganizationId()` and the `ITenantContext` contract.
- Identity is **global** (one `users` row per person, email globally unique);
  `organization_members` is the tenancy link. The access token carries a
  nullable `org` claim + the perms *for that org*; `POST /auth/refresh
  {organizationId}` switches tenant without re-login. Any authenticated user may
  create an organization and becomes its `owner` + tenant-scoped `admin`.

## Data ownership (Plan §5)

Identity owns `users`, tokens. Every other module stores only a `userId`
reference and reaches user data through `IUserProvider`. `audit_logs` and
`files` keep **no** foreign key to `users` — the trail and file metadata must
outlive user deletion and never be touched by a cascade.

## Events: two delivery mechanisms (Plan §6.1)

| Handler touches… | Mechanism | Registered with |
|---|---|---|
| only the database | in-process bus, runs inside the publisher's transaction | `registry.onInProcess(event, handler)` |
| anything outside the DB (email, SMS, webhook, gateway) | transactional outbox → background worker with retries | `registry.onExternal(event, name, handler)` |

`EventBus.publish()`:
- runs in-process handlers now, on the caller's transaction (a throw rolls
  everything back — intentional);
- if the event has any external subscriber, writes **one** `outbox_messages`
  row on the same transaction.

`OutboxWorker` (a DB-polling loop — no Redis in v0.1):
- claims due rows with `FOR UPDATE SKIP LOCKED`, marks them `processing`;
- runs the external handlers; on success → `delivered`;
- on failure → exponential backoff, back to `pending`, `attempts++`;
- at `max_attempts` (default 5) → row copied to `dead_letter_messages` with
  payload + error + retry history, outbox row marked `failed`. Never silently
  dropped (Plan §6.2).
- `releaseStale()` recovers rows a crashed worker left `processing`.

### Worker monitoring is mandatory (Plan §6.2, §7.12)

`GET /api/health/ready` reports `outbox` backlog (`pending`, `processing`,
`failed`, `deadLettered`) and the worker's `lastTickAt` / `lastError`, and
returns **503** if the worker is stopped, erroring, badly backed up, or has
any dead-lettered message.

## What v0.1 covers per module

- **identity** — register / login / logout / refresh / verify-email /
  forgot+reset password. Access = short-lived HS256 JWT; refresh = opaque
  random string stored as SHA-256 hash, rotated on use, family-revoked on
  reuse (theft detection).
- **rbac** — `roles`, `permissions` (`action:resource`), `role_permissions`,
  `user_roles`. `can()` supports `*` wildcards. Seeds an `admin` role holding
  `*:*`. Permissions are contributed by each module's `permissions/` file and
  registered on boot.
- **organizations** — org + members + JSON settings. The organization is the
  tenant (see Multi-tenancy above); `organization_members` is the tenancy link,
  and both tables are RLS-scoped.
- **audit** — append-only; `UPDATE`/`DELETE` blocked by a DB trigger.
- **files** — `IFileStorage` (upload/getUrl/getContent/delete) + local-disk
  adapter; interface ready for an S3 adapter with no use-case change. HTTP
  endpoints add RBAC (`file:read` / `file:delete`) on top of owner access.
- **notifications** — `INotificationProvider.send()`. In-app rows written in
  the caller's transaction; email published as an event → outbox → worker.
  Bilingual templates seeded on boot, overridable per client.
- **localization** — `directionOf`, `negotiateLocale`, `Translatable<T>`
  (AR-first), `Intl`-based `ar-EG` / `en-EG` formatters (Hijri calendar
  option already threaded, output is "Later").
- **observability** — pino structured logs with a correlation-id mixin, a
  global `AppExceptionFilter` mapping `AppError.kind` → status (Nest's default
  handler covers 404), and `HealthController` (`/api/health`, `/api/health/ready`
  — the latter 503s on a stopped / backed-up / dead-lettering outbox worker).

## Deliberately deferred (Plan §7, §8)

workflow/approval engine · reporting skeleton · SMS/push · 2FA/OAuth · file
thumbnails/virus-scan/versioning · metrics/alerting beyond the health endpoint ·
per-tenant custom roles · tenant suspend/export/delete · org invitations (a
non-member is added today via `POST /organizations/:id/members`) · DB-per-tenant.
Each waits for a real project.
