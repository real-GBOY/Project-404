# AURIC Core — Architecture (v0.1)

This describes what was actually built. It implements the decisions in
[`../Plan.md`](../Plan.md) sections 3–6; read that first for the *why*.

## Shape: modular monolith

One deployable process. Modules are logical boundaries, not services. They
never call each other directly and never touch each other's tables — they
talk through the provider interfaces in `core/contracts/` (Plan §4). The
`/api` router mounts every module's routes onto one Express app in-process;
there is no gateway service.

```
HTTP (Express)  ─ correlation-id ─ locale ─ request-log ─ json body
      │
      ▼  /api
  health · identity · rbac · organizations · audit · files · notifications
      │
      ▼  each controller: validate (Zod) → guard (RBAC) → call a use case
APPLICATION  use-case owns the transaction; publishes events inside it
      │
      ▼
DOMAIN  entities + rules (no SQL, no HTTP)
      │
      ▼
INFRASTRUCTURE  repositories (the only code that knows Postgres) via Kysely
      │
      ▼
PostgreSQL
```

## The request lifecycle (Plan §3.4), concretely

`POST /api/auth/register`:

1. `correlationId()` opens an `AsyncLocalStorage` context — every log line,
   audit row and outbox message downstream carries the same id.
2. `localeMiddleware` resolves AR/EN from `?locale` → `Accept-Language` →
   default, sets `Content-Language` + `X-Content-Direction`.
3. Router → `identityRoutes` → controller. Zod validates the body.
4. `IdentityService.register()` — **the use case owns the transaction**:
   `unitOfWork.transaction(async () => { … })`.
   - build `UserEntity` (domain decides: new user is `pending`)
   - `userRepository.insert()`
   - `auditLogger.record()` — same transaction
   - `eventBus.publish("user.registered")` — same transaction
   - issue an email-verification token, `publish("user.email_verification_requested")`
5. Commit. Response travels back up. Frontend shows the created user.

Nothing threads a transaction handle around: repositories and the event bus
read the ambient transaction via `currentExecutor()` (an `AsyncLocalStorage`
set by `unitOfWork.transaction`). This is the Plan's "the bus merely runs
inside the transaction the caller controls."

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
- **organizations** — org + members + JSON settings. Single-tenant: no
  `tenant_id`, no RLS (Plan §7.3).
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
- **observability** — pino structured logs with correlation-id mixin, request
  logger, single error→HTTP mapper, health + readiness.

## Deliberately deferred (Plan §7, §8)

multi-tenancy · workflow/approval engine · reporting skeleton · SMS/push ·
2FA/OAuth · file thumbnails/virus-scan/versioning · metrics/alerting beyond
the health endpoint. Each waits for a real project.
