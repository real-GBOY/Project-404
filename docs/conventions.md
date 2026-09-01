# AURIC Core — Conventions

## Language & tooling

- TypeScript, ESM, `strict`, `experimentalDecorators` + `emitDecoratorMetadata`
  (Nest DI). `verbatimModuleSyntax` — use `import type` for type-only imports,
  but a class that is DI-injected must be a **value** import.
- Module resolution is `Bundler`; relative imports are written **with** a
  `.js` extension (`./foo.js`).
- Runtime + tests transform via **SWC** (`.swcrc`) — esbuild does not emit the
  decorator metadata Nest needs. `npm run serve` / `dev` = `node --import
  @swc-node/register/esm-register`; Vitest uses `unplugin-swc`.
- Formatting/lint: keep to the surrounding style. No runtime `console.*` —
  use the logger.

## NestJS

- Every service, repository, and provider is `@Injectable()`. Each Core
  capability is a `@Module` (`core/<cap>/<cap>.module.ts`); `core/app.module.ts`
  composes them; `main.ts` bootstraps on the Fastify adapter.
- Cross-module contracts (§4) are bound to symbol tokens in
  `core/kernel/tokens.ts` (`USER_PROVIDER`, `EVENT_BUS`, …). Inject with
  `@Inject(TOKEN)`; a module `exports` the token, the consumer `imports` the
  module. `KernelModule` (config/clock/uow) and `SecurityModule` (guards +
  identity/RBAC contracts) are `@Global()`.
- The identity ↔ organizations cycle uses `forwardRef(() => OtherModule)` on
  both sides.
- Event subscribers register in the module's `OnModuleInit`; the outbox worker
  starts/stops via `OnApplicationBootstrap` / `OnApplicationShutdown` (gated by
  the `WORKER_AUTOSTART` token — `false` in tests).

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

## HTTP (Nest controllers)

- One `@Controller` per module, in `core/<cap>/api/<name>.controller.ts`. The
  `/api` prefix is global (`main.ts`); never set it in a module.
- Handlers: validate with a Zod pipe (`@Body(ZodBody(schema))`,
  `@Query(ZodQuery(schema))`) → call one use case → return a plain object. No
  business logic, no DB. A thrown `AppError` is turned into a response by the
  global `AppExceptionFilter` (`kind` → status).
- Auth/permissions are guards: `@UseGuards(JwtAuthGuard, PermissionGuard)` on
  the controller, `@RequirePermission("update", "organization")` on the method.
  `PermissionGuard` does a **live** RBAC check (not a token-claims read),
  wrapped in `readInTenant`. Read the caller with `@CurrentUser()`.
- Public routes (login, register, refresh) carry no `@UseGuards`.
- Non-2xx codes via `@HttpCode(204)`; stream a body with `@Res() reply` (Fastify
  reply). File upload reads `req.file()` (`@fastify/multipart`, registered in
  `main.ts`) — Nest's `FileInterceptor` is Express-only.

## Localization

- User-facing strings that vary by language are `Translatable<T>` — write
  `ar` first.
- Format dates/numbers/currency only through
  `core/localization/formatters` (AR-EG defaults, EGP, Africa/Cairo).
- Keep integrations/compliance out of this module (Plan §12).

## Tests

- Unit tests next to the code (`*.test.ts`), no DB, no Nest (`new TheClass(stub)`).
- Integration tests in `core/tests/`, gated on `AURIC_TEST_DATABASE_URL`.
  `createTestCore()` (helpers) resets + migrates the schema as owner, compiles
  `AppModule` as `auric_app` (so RLS is live), seeds, and wires subscribers;
  `overrideProvider` swaps `CLOCK` / `EMAIL_CHANNEL` / `REQUIRE_EMAIL_VERIFICATION`.
  Pull services with `get(core, TheClass)` (non-strict `moduleRef.get`).
- Wrap direct service calls in `asUser(userId, orgId, fn)` / `asSystem(fn)` to
  stand in for the request context.
- Drive the outbox worker with `worker.tick()`; advance a `fixedClock` past
  backoff windows rather than sleeping.

## The governing rule (Plan §0)

Before adding anything to Core: has a real project required it, or is it
fundamental infrastructure whose shape is well understood? If neither, it does
not belong here yet. Build it in the client project; extract later if it
recurs (rule of three for domain-flavoured code).
