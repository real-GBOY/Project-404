# AURIC Core — Conventions

## Language & tooling

- TypeScript, ESM, `strict`. `verbatimModuleSyntax` — use `import type` for
  type-only imports.
- Module resolution is `Bundler`; relative imports are written **with** a
  `.js` extension (`./foo.js`) so the same source runs under tsx, Vitest, and
  a future bundled build.
- Formatting/lint: keep to the surrounding style. No runtime `console.*` —
  use the logger.

## Errors

- Throw `AppError` (or the helpers `ValidationError`, `NotFound`, `Conflict`,
  `Forbidden`, `Unauthenticated`, `Internal`) from any layer.
- Domain/application code never imports HTTP. The single
  `errorHandler` middleware maps `AppError.kind` → status code.
- Error `code` is machine-readable and namespaced: `identity.email_taken`,
  `rbac.role_not_found`.

## Identifiers

Prefixed, k-sortable-ish random: `usr_…`, `org_…`, `role_…`, `file_…`,
`aud_…`, `obx_…`. Generate with `newId(prefix)`.

## Time

Never call `new Date()` / `Date.now()` in Core logic. Take a `Clock` and call
`clock.now()`. Tests inject `fixedClock()`.

## Database

- All access through Kysely; the schema type in `core/kernel/db/schema.ts` is
  **generated** by `prisma-kysely` from `prisma/schema/*.prisma` — edit the
  model, then `npm run db:generate`. Never hand-edit `schema.ts`.
- Repositories are the only code that references tables. They call
  `currentExecutor()` — no executor argument in method signatures.
- **Tenant scoping (docs/tenancy.md):** tenant-scoped tables are guarded by
  row-level security. A read that reaches the raw pool sees nothing — so every
  tenant-scoped query runs inside `unitOfWork.transaction` (which sets
  `app.organization_id` / `app.user_id`); wrap a lone read in `readInTenant()`.
  Write an `organization_id` from `currentOrganizationId()` (nullable columns) or
  `requireOrganizationId()` (NOT NULL). Cross-tenant / pre-tenant work (signup,
  webhooks, the outbox worker) runs in `runAsSystem()`.
- Timestamps read/written as `Date`. `created_at` / `updated_at` are
  DB-defaulted (`Generated<Date>`); `updated_at` is bumped by the
  `auric_set_updated_at` trigger.
- JSONB: plain objects can be passed straight through; **arrays and
  primitives must be `JSON.stringify`-ed** on write (node-postgres would
  otherwise coerce an array to a Postgres array literal).
- Migrations: Prisma-owned in `prisma/migrations/`. Change a model, then
  `npm run migrate:dev -- --name <change>` to generate the SQL; add CHECK
  constraints / triggers / partial indexes by hand to that migration (Prisma
  can't express them). `npm run migrate` (= `prisma migrate deploy`) applies.

## Events

- Name: `<module>.<pastTenseAction>` — `user.registered`, `order.cancelled`.
- Payloads are versioned (`version: n`) and owned by the publishing module.
- Handlers must be idempotent.
- Choose delivery by side-effect location, not by importance
  (`onInProcess` vs `onExternal`) — see the integration guide.

## HTTP (Fastify)

- Each module exports its routes as a `FastifyPluginAsync`, registered under
  `/api` by the composition root. Never wire auth or prefixes inside a module.
- Handlers: validate (`parseBody` / `parseQuery` with a Zod schema) → call one
  use case → return / `reply.send`. No business logic, no DB. Fastify handles
  async + turns a thrown `AppError` into a response via `setErrorHandler`.
- Auth and permissions are `preHandler` hooks: `{ preHandler: ctx.authenticate }`
  or `{ preHandler: ctx.guard(action, resource) }`. `guard` does a **live**
  RBAC check, not a token-claims read. Plugin-wide: `app.addHook("preHandler", ctx.authenticate)`.
- Typed route params: `app.get<{ Params: { id: string } }>("/x/:id", …)`.
- Per-request context is bound in an `onRequest` hook with
  `enterContext(...)` (`enterWith`, since the Fastify lifecycle can't be
  wrapped in a callback).

## Localization

- User-facing strings that vary by language are `Translatable<T>` — write
  `ar` first.
- Format dates/numbers/currency only through
  `core/localization/formatters` (AR-EG defaults, EGP, Africa/Cairo).
- Keep integrations/compliance out of this module (Plan §12).

## Tests

- Unit tests next to the code (`*.test.ts`), no DB.
- Integration tests in `core/tests/`, gated on `AURIC_TEST_DATABASE_URL`,
  reset the schema (as owner) and boot the real Core (as `auric_app`, so RLS is
  live). Wrap direct service calls in `asUser(userId, orgId, fn)` /
  `asSystem(fn)` from `helpers.ts` to stand in for the request context.
- Drive the outbox worker with `worker.tick()`; advance a `fixedClock` past
  backoff windows rather than sleeping.

## The governing rule (Plan §0)

Before adding anything to Core: has a real project required it, or is it
fundamental infrastructure whose shape is well understood? If neither, it does
not belong here yet. Build it in the client project; extract later if it
recurs (rule of three for domain-flavoured code).
