# Building a product on AURIC Core

A practical guide for a developer starting a **new product** (a "Project #3") on Core — or adding a
feature to Mizan/Atlas. Every snippet here is taken from, or a direct generalisation of, code that
exists in the repo (`mizan/backend/app`, `atlas/backend/app`); where it matters the source file is
named. For *what Core is* read `docs/CORE.md`; for the per-module contracts read
`core/<module>/README.md`. This document is the *how*.

---

## 0. Read this first: how Core is consumed today

There is **no published `@auric/core` package and no version pin yet.** Products consume Core's
**source** through a path alias:

| | Mizan | Atlas |
|---|---|---|
| Alias | `@core/*` → `./core/*`, `@app/*` → `mizan/backend/app/*` | `@core/*` → `../../core/*`, `@atlas/*` → `./app/*` |
| Dependencies | the repo-root `package.json` | **none of its own** — resolves everything from the repo-root `node_modules` |

So a new product today is **a new folder in this repo** (or a fork of it), next to `core/`. Two
consequences you must respect:

1. **A Core change reaches every product on its next build.** Keep Core changes backward compatible
   and run *all* products' tests before merging.
2. **Do not `npm install` inside a product folder.** Core's source is compiled as part of your
   package; a second copy of `@nestjs/*`, `fastify`, `kysely` or `reflect-metadata` creates a
   dual-package hazard (two module instances → broken DI and spurious type errors). Always install at
   the repo root. (Atlas's `package.json` explains this in its `comment_dependencies`.)

When Core is cut into a versioned package (see `docs/CORE.md` §9), only §1 and §2 of this guide
change; everything else stays the same because you depend on tokens and interfaces, not paths.

---

## 1. The 12-step checklist

1. Create `<product>/backend/` (copy Atlas's skeleton: `app/`, `scripts/`, `prisma/`, `main.ts`,
   `tsconfig.json`, `vitest.config.ts`, `prisma.config.ts`, `package.json`).
2. Set the path aliases (§3).
3. Write `app/version.ts` and `main.ts` → `bootstrapAuricApp` (§4).
4. Write `app/app.module.ts` — the composition root (§5).
5. Create the product's own Postgres **database** and a `.env` (§10).
6. Create the Prisma project: copy Core's baseline migrations, then add your tables (§6).
7. Add `organization_id` + RLS to every table you own (§6.3).
8. Define permissions and roles; write `AppSeedService` (§7).
9. Build domain modules in the standard anatomy (§8).
10. Publish events, audit sensitive operations, add notifications where needed (§9).
11. Use Core files where needed (§11); optionally add the AI assistant / messaging (§12).
12. Add tests (§14) and a deploy unit (§15). Then build the web client (§13).

---

## 2. Target layout

```
<product>/
├── backend/
│   ├── main.ts                  ← bootstrapAuricApp(...)
│   ├── package.json  tsconfig.json  vitest.config.ts  prisma.config.ts
│   ├── scripts/                 ← migrate.ts, build.mjs
│   ├── prisma/
│   │   ├── schema/              ← datasource.prisma + <domain>-*.prisma
│   │   └── migrations/          ← Core baseline (copied) + your migrations
│   └── app/
│       ├── app.module.ts        ← composition root
│       ├── seed.ts              ← AppSeedService
│       ├── version.ts
│       └── <domain>/            ← e.g. realestate/, lawfirm/
│           ├── <domain>.module.ts
│           ├── permissions.ts   ← aggregates each module's permissions
│           ├── shared/          ← ids, roles, rbac re-exports
│           ├── db/              ← generated Kysely types + executor.ts
│           └── <feature>/       ← api/ application/ infrastructure/ events/
│                                  permissions/ validation/ tests/ <feature>.module.ts
└── web/                         ← React/Vite client (§13)
```

---

## 3. Path aliases and tooling

`tsconfig.json` (Atlas, `atlas/backend/tsconfig.json`):

```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "rootDir": "../..",                       // Core's source is inside the compilation
    "strict": true, "verbatimModuleSyntax": true,
    "experimentalDecorators": true, "emitDecoratorMetadata": true,   // required by Nest DI
    "paths": { "@core/*": ["../../core/*"], "@yourproduct/*": ["./app/*"] }
  },
  "include": ["../../core", "app", "scripts", "main.ts", "vitest.config.ts", "prisma.config.ts"]
}
```

`vitest.config.ts` needs the same aliases, the SWC plugin (decorators), `fileParallelism: false`
(integration suites share one database) and `setupFiles: ["../../core/tests/setup.ts"]`.

Runtime is SWC (`@swc-node/register/esm-register`); `build.mjs` type-checks, emits JS and rewrites
the aliases to relative paths (Node can't resolve tsconfig `paths`). Copy Atlas's `scripts/build.mjs`.

Rules of the codebase: ESM, `.js` extensions on relative imports, `import type` where possible
(`verbatimModuleSyntax`), Node `^22.12 || >=24`.

---

## 4. Entry point

```ts
// <product>/backend/main.ts   (compare atlas/backend/main.ts)
import "reflect-metadata";
import { AppModule } from "@yourproduct/app.module.js";
import { AppSeedService } from "@yourproduct/seed.js";
import { APP_NAME, APP_CODENAME, APP_VERSION } from "@yourproduct/version.js";
import { bootstrapAuricApp } from "@core/http/bootstrap.js";
import { migrateToLatest } from "./scripts/migrate.js";

void bootstrapAuricApp({
  module: AppModule,
  identity: { name: APP_NAME, codename: APP_CODENAME, version: APP_VERSION },
  migrate: migrateToLatest,                 // YOUR Prisma project (see §6.4)
  seed: (app) => app.get(AppSeedService).seed(),
});
```

`bootstrapAuricApp` owns the HTTP mechanics and the boot order **migrate → build → configure →
seed → listen**: Fastify limits, multipart, the raw-body parser for local uploads, the `/api` global
prefix, shutdown hooks, CORS (`AURIC_CORS_ORIGINS`, `*.example.com` = suffix match), OpenAPI. It takes
exactly four things — `module`, `identity`, optional `migrate`, `seed` — deliberately not an options
bag. Register routes through your Nest modules, not here.

`version.ts` is your **product's** identity/version (e.g. `"Atlas RE OS" / "atlas" / "0.1.0"`). It is
not Core's version.

---

## 5. The composition root

```ts
// <product>/backend/app/app.module.ts   (compare atlas/backend/app/app.module.ts)
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import {
  KernelModule, EventsModule, AuditModule, RbacModule, IdentityModule,
  OrganizationsModule, NotificationsModule, FilesModule,
  // MessagingModule,            // opt in only if you need realtime conversations
  SecurityModule, SeedService,
} from "@core/index.js";
import { AppExceptionFilter } from "@core/http/app-exception.filter.js";
import { RequestContextMiddleware } from "@core/http/request-context.middleware.js";
import { HealthController } from "@core/observability/health.controller.js";
import { YourDomainModule } from "@yourproduct/yourdomain/yourdomain.module.js";
import { AppSeedService } from "./seed.js";

@Module({
  imports: [
    KernelModule, EventsModule, AuditModule, RbacModule, IdentityModule,
    OrganizationsModule, NotificationsModule, FilesModule, SecurityModule,
    YourDomainModule,
  ],
  controllers: [HealthController],
  providers: [
    SeedService, AppSeedService, RequestContextMiddleware,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("{*path}");
  }
}
```

Non-obvious points:

- **Re-apply the middleware and exception filter.** A `NestModule.configure()` only runs for the
  *root* module, so you cannot inherit them from Core. Skip this and you lose correlation IDs,
  locale binding and the uniform error envelope.
- **Do not boot `core/app.module.ts`.** It is Core's own integration-test fixture, not a composition
  root.
- **Health endpoints** (`/api/health`, `/api/health/ready`) come from `HealthController` — you list
  it yourself.
- Importing these modules gives you, with no code: `auth/*`, `me`, `rbac/*`, `organizations/*`,
  `files/*`, `audit-logs`, `notifications/*` (+ `conversations/*` and `/socket.io` with Messaging).

---

## 6. Database

Prisma owns the schema and migration history; **Kysely runs every query** (no Prisma Client).
Postgres is the only datastore.

### 6.1 One database per product

Each product gets its **own database** (same cluster is fine — a database is a hard boundary). Own
users, orgs, roles, JWT secret and port. Mizan = database `auric`, Atlas = `atlas`.

### 6.2 The Prisma project

```
<product>/backend/prisma.config.ts     ← schema: "prisma/schema", url: env("AURIC_DATABASE_URL")
<product>/backend/prisma/schema/datasource.prisma
<product>/backend/prisma/schema/<domain>-<feature>.prisma
<product>/backend/prisma/migrations/
```

`datasource.prisma` declares only your kysely generator (Core's own tables have no Prisma model in
your project — they arrive as **copied SQL**):

```prisma
datasource db { provider = "postgresql" }

generator kysely {
  provider        = "prisma-kysely"
  output          = "../../app/yourdomain/db"
  fileName        = "schema.ts"
  importExtension = ".js"
  dbTypeName      = "YourdomainTables"
  banner          = "import type { Json } from \"../../../../../core/kernel/db/json.js\";"
}
```

**Copy Core's baseline migrations** from the root `prisma/migrations/` into yours, in order — only
the Core ones, not the law-firm ones. As of today that is:

```
20260829120000_baseline
20260829120100_constraints_triggers_indexes
20260901120000_multitenancy_columns
20260901120100_multitenancy_rls
20260908070933_files_upload_status
20260916120000_core_assistant          (only if you use the assistant — Atlas's copy; the root repo's `…_core_assistant_rename` exists only because Mizan already had product-named assistant tables)
20260918120000_core_messaging          (only if you use Messaging)
```

Compare with `atlas/backend/prisma/migrations/` for the exact set Atlas carries. Then add yours
after them. Core tables never change under you unless you copy a newer Core migration in — which is
a deliberate step, and must be done for **every** product database.

### 6.3 Your tables: `organization_id` + RLS (mandatory)

Every table you own gets `organization_id text NOT NULL` and this policy in its migration (from
`atlas/.../20260914120000_realestate/migration.sql`):

```sql
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['yourdomain_things', 'yourdomain_other_things'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.organization_id'', true))
         WITH CHECK (organization_id = current_setting(''app.organization_id'', true))', t);
  END LOOP;
END $$;
```

Grants to `auric_app` / `auric_system` are covered by `ALTER DEFAULT PRIVILEGES` in Core's
migrations. Use `auric_set_updated_at()` for `updated_at` triggers. Hand-add any CHECK constraints,
triggers or partial indexes to the migration — Prisma can't express them. Prefix table names with
your domain (`realestate_*`, `lawfirm_*`) to avoid future collisions.

Workflow: `npm run migrate:dev -- --name <change>` → edit the SQL → `npm run db:generate`
(regenerates the Kysely types).

### 6.4 Migrations at boot

Core's `migrateToLatest` **hard-codes the repo-root Prisma project** as its package root, so a second
product cannot reuse it. Copy `atlas/backend/scripts/migrate.ts` (~30 lines: it shells the bundled
`prisma migrate deploy` with `AURIC_DATABASE_URL`, pointed at *your* `prisma.config.ts`) and pass it
as `migrate` in §4. (A parameterised Core `migrate` is a listed extraction candidate for when a third
product makes it a real repeat.)

### 6.5 Typed access to your tables

Core's executor is typed to Core's own `Database`. Widen it once, in your `db/executor.ts`:

```ts
import { currentExecutor } from "@core/kernel/db/db.js";
import type { YourdomainTables } from "./schema.js";

export function yourdomainDb() {
  return currentExecutor().withTables<YourdomainTables>();   // same connection / same transaction
}
```

A write through `yourdomainDb()` and a call to `AUDIT_LOGGER.record()` / `EVENT_BUS.publish()` inside
one `uow.transaction(...)` really share a single Postgres transaction.

### 6.6 The three database roles

| Role | Used for | RLS |
|---|---|---|
| `auric_owner` (`AURIC_DATABASE_URL`) | migrations, `provision-db` | owner |
| `auric_app` (`AURIC_APP_DATABASE_URL`) | normal runtime | **enforced** (no BYPASSRLS) |
| `auric_system` (`AURIC_SYSTEM_DATABASE_URL`) | signup, webhooks, the outbox worker | bypasses |

The Core migrations create the roles `NOLOGIN`; `scripts/provision-db.ts` gives them a login. With
only `AURIC_DATABASE_URL` set (single-role dev) RLS exists but is **not enforced** — a superuser
bypasses it — so test tenancy against the two low-privilege roles.

---

## 7. Permissions, roles, seeding

Permission keys are `action:resource` (`read:payment`). Each feature module exports its own list:

```ts
// finance/permissions/permissions.ts
import type { PermissionDefinition } from "@core/rbac/domain/permission.js";
export const financePermissions: PermissionDefinition[] = [
  { action: "read",   resource: "payment", description: "View payments." },
  { action: "record", resource: "payment", description: "Record a payment." },
];
```

Aggregate them in `<domain>/permissions.ts` (`…financePermissions, …salesPermissions`), define roles
as `RoleSeed[]` (`key`, `name`, `description`, `permissionKeys: string[]`; add your own metadata by
extending the interface), then seed:

```ts
@Injectable()
export class AppSeedService {
  constructor(private readonly coreSeed: SeedService, private readonly rbac: RbacRepository,
              @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork) {}

  async seed() {
    await this.coreSeed.seed();     // Core permissions + `admin` (*:*) role + notification templates
    await runAsSystem(() =>
      seedRbacDefinitions(this.rbac, this.uow, { permissions: PERMISSIONS, roles: ROLES }));
  }
}
```

The seed is **idempotent** and runs on every boot. Rules:

- Domain code **never branches on a role key** — only on permissions (`@RequirePermission`,
  `IPermissionProvider.can`). Roles are editable bundles at runtime through `/api/rbac`.
- Roles and permissions are **global**; only `user_roles` assignments are tenant-scoped ("admin in
  org A, viewer in org B").
- Core seeds only *platform* permissions (`read:organization`, `manage:role`, `read:conversation`…).
  Grant an org-admin role the Core keys it needs alongside yours (see `CORE_ADMIN_KEYS` in
  `atlas/.../shared/roles.ts`); validate role→permission references at load (Atlas throws on an
  unknown key).

---

## 8. Writing a feature module

Anatomy (docs/conventions.md): `domain/ application/ infrastructure/ api/ events/ permissions/
validation/ tests/ <feature>.module.ts`. Layers depend inward: `api → application → infrastructure`,
domain depends on nothing.

### 8.1 Controller — thin

```ts
@ApiTags("yourdomain · payments")
@ApiBearerAuth("access-token")
@Controller("yourdomain/payments")
@UseGuards(JwtAuthGuard, PermissionGuard)          // authn, then authz
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @RequirePermission("read", "payment")
  list(@Query(ZodQuery(listPaymentsQuery)) q: ListPaymentsQuery) { return this.service.list(q); }

  @Post() @HttpCode(201)
  @RequirePermission("record", "payment")
  record(@Body(ZodBody(recordPaymentSchema)) body: RecordPaymentBody, @CurrentUser() user: Principal) {
    return this.service.record(body, user.userId);
  }
}
```

The pipeline per request: JWT verified → tenant bound → `PermissionGuard` does a **live** in-tenant
permission check → Zod validates → use case. **No business logic here.** Identity always comes from
the token (`@CurrentUser`); never trust an `organizationId` or `userId` from a request body.

### 8.2 Service (use case) — owns the transaction

```ts
@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS)    private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter) { return readInTenant(() => this.repo.list(filter)); }      // reads

  async record(body, actorId: string) {                                    // writes
    return this.uow.transaction(async () => {
      const created = await this.repo.create(body);
      await this.audit.record({
        actorId, action: "yourdomain.payment.recorded",
        resourceType: "yourdomain_payment", resourceId: created.id, after: created,
      });
      await this.events.publish(paymentRecorded({ paymentId: created.id, actorId }));
      return created;
    });
  }
}
```

- **Writes** → `uow.transaction(...)`. **Reads** → `readInTenant(...)`. Both run inside a tenant-bound transaction
  (`readInTenant` is a `uow.transaction` wrapper; the tenant setting is what RLS reads), which is what makes RLS work. A query on the raw pool has no
  tenant and sees nothing.
- The order is always `authn → validate → transaction → persist → audit → publish`. The event bus
  never opens a transaction; **the use case does.**
- Audit and event publication go **inside** the transaction — no "the change committed but the audit
  line didn't".
- Namespace audit actions and events with your domain (`yourdomain.payment.recorded`).

### 8.3 Repository — Kysely, tenant-explicit

```ts
@Injectable()
export class PaymentsRepository {
  private org() { return requireOrganizationId(); }         // throws if there is no tenant

  async list(filter): Promise<PaymentRow[]> {
    return yourdomainDb()
      .selectFrom("yourdomain_payments").selectAll()
      .where("yourdomain_payments.organization_id", "=", this.org())   // belt and braces
      .execute();
  }
}
```

RLS is the backstop; the repositories still filter by `organization_id` explicitly (Atlas does), so
a bug is caught in review *and* by the database. Composite joins should also match on
`organization_id`. IDs come from Core's prefixed-ID factory (`createPrefixedId`) with your own
prefixes.

### 8.4 Module wiring

```ts
@Module({
  imports: [AuditModule /*, other feature modules you call */],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService],
  exports: [PaymentsService],
})
export class FinanceModule {}
```

Core's `KernelModule` is `@Global`, so `UNIT_OF_WORK`, `CLOCK`, `CONFIG` need no import. Import the
Core modules whose *providers* you inject (e.g. `AuditModule`). Inject Core **by token**
(`@Inject(AUDIT_LOGGER)`), never by concrete class, and never reach into
`core/<module>/{domain,application,infrastructure}` — the one sanctioned exception is the seed script.

### 8.5 Provider interfaces (what you may depend on)

`IUserProvider` (`getUser`, `userExists`) · `IOrganizationProvider` (`getOrganization`, `isMember`,
`membershipsForUser`) · `ITenantContext` · `IPermissionProvider` (`can`, `assignRole`,
`permissionsFor`) · `INotificationProvider` (`send`) · `IFileStorage` · `IAuditLogger` (`record`) ·
`IEventBus` (`publish`) — all in `core/contracts`, bound to tokens in `core/kernel/tokens.ts`.
To show "assigned to Nour" don't `SELECT … FROM users`: store `userId`, resolve names with
`UserDirectory` (exported from Core) or `IUserProvider`.

---

## 9. Events, audit, notifications

### 9.1 Define and publish

```ts
// yourdomain/payments/events/events.ts   (pattern: mizan/.../matters/matter.events.ts)
export const PaymentEvents = { Recorded: "yourdomain.payment.recorded" } as const;
export const paymentRecorded = (p: { paymentId: string; actorId: string }): DomainEvent =>
  ({ name: PaymentEvents.Recorded, version: 1, payload: p });
```

### 9.2 Subscribe — pick the delivery by side-effect

| The reaction… | Register with | Runs |
|---|---|---|
| only writes another row in the same DB | `registry.onInProcess(name, handler)` | synchronously, **inside** the publisher's transaction |
| touches anything external (email, webhook, LLM, realtime broadcast) | `registry.onExternal(name, "unique-handler-name", handler)` | via the **outbox**: only after COMMIT, worker-delivered, retried, dead-lettered |

Register in the module's `OnModuleInit`, injecting `EventRegistry`. `onExternal` handler names must
be unique per event (registering a duplicate throws). External handlers must be **idempotent** —
delivery is at-least-once with retry; exactly-once is achieved by the outbox row being written in the
same transaction plus your idempotent handler. Do not use the outbox anywhere else.

Atlas's `conversation-intelligence/events/subscribers.ts` is the reference for the two-hop pattern:
an in-process handler does one cheap DB write (an "analysis requested" outbox row); an external
handler does the slow LLM work after commit, isolated from the message-send path.

### 9.3 Notifications

`INotificationProvider.send({ userId, templateKey, channels })` resolves a bilingual (AR/EN)
template, writes the in-app row and enqueues email through the outbox. Register your own templates
at seed time (see `core/notifications/README.md` and how `SeedService` seeds Core's).
Account-level notifications have `organization_id NULL` and show in every tenant context.

---

## 10. Configuration and environment

Copy `.env.example`; every `AURIC_*` value has a default. The ones you must set per product:

| Variable | Notes |
|---|---|
| `AURIC_DATABASE_URL` | owner connection — migrations + `provision-db` |
| `AURIC_APP_DATABASE_URL` / `AURIC_SYSTEM_DATABASE_URL` | the two runtime roles (production requires them for RLS to bite) |
| `AURIC_JWT_SECRET` | **unique per product**; required non-default in production (`openssl rand -base64 48`) |
| `AURIC_PORT` | own port per product |
| `AURIC_CORS_ORIGINS` | your web origin(s); `*.vercel.app`-style suffix entries allowed |
| `AURIC_APP_NAME`, `AURIC_APP_URL` | used in emails/templates |
| `AURIC_FILE_STORAGE_DRIVER` | `local` (dev) or `r2` (+ `AURIC_R2_*`) |
| `AURIC_SMTP_URL`, `AURIC_MAIL_FROM` | unset → dev transport logs instead of sending |
| `AURIC_AI_*` | only if you use the assistant |

Product-only toggles (e.g. `ATLAS_SEED_DEMO=true`) belong to the product, not Core config. Secrets
live only in the server `.env` — never commit them.

---

## 11. Files

Use Core's presigned flow; never touch S3/R2/disk directly.

```
POST /api/files/uploads   → { fileId, uploadUrl }     (permission-checked, tenant-namespaced key)
PUT  <uploadUrl>          (browser → storage directly; bytes never pass through the API process)
POST /api/files/:id/confirm  → HEADs the object, marks the file `stored`
```

`presign ≠ uploaded`; `confirm` verifies the object exists. Your domain stores only the `file_id`
(plus any display snapshot) and checks `stored` + same tenant + uploader before linking it to a
record. Downloads go through `IFileStorage` / signed URLs. Details: `core/files/README.md`.

---

## 12. Opt-in capabilities

### 12.1 AI assistant

Core is the **engine**; the product supplies everything that has meaning. There is no
`AssistantModule` in Core — you write your own `assistant.module.ts` and list Core's classes in its
`providers` (Nest tokens are module-scoped, so the tools/config must live beside the classes that
consume them):

```ts
@Module({
  providers: [
    ReadTools, WriteTools,                                    // YOUR tool classes
    { provide: ASSISTANT_TOOLS, useFactory: (r, w) => [...r.tools(), ...w.tools()], inject: [ReadTools, WriteTools] },
    { provide: ASSISTANT_DOMAIN_CONFIG, useValue: { domainKey: "yourdomain", buildSystemPrompt } },
    { provide: SCOPE_GUARD_CONFIG, useValue: yourScopeVocabulary },
    { provide: AI_CLIENT, useClass: OpenAiCompatibleClient },
    { provide: ASSISTANT_CONFIG, inject: [CONFIG], useFactory: assistantConfigFromAuricConfig },
    ToolRegistry, ScopeGuard, ConversationRepository, AssistantService,   // Core's classes
  ],
  controllers: [AssistantController],     // YOURS: route, DTOs, and the gating permission
})
export class AssistantModule {}
```

Each tool is a thin adapter over a service you already have, declares the `{action, resource}` it
requires (never `null`), and is validated with Zod. `ToolRegistry.run()` performs
`lookup → parse → validate → permissions.can() in the tenant → execute` and never throws. The model
never sees SQL. Mark mutating tools `mutates: true` and expose only operations your use cases already
support. Add cross-tenant and permission-deny tests per tool. For "prompt → JSON" features (not a
chat), use `StructuredAi` (validate + repair-retry). Full contract: `core/assistant/README.md`,
worked examples: `docs/assistant.md`, `docs/atlas-assistant.md`. Migration: copy Atlas's
`…_core_assistant` migration (`ai_conversations`, `ai_messages`).

### 12.2 Messaging

Import `MessagingModule`, copy the `core_messaging` migration, and you get `conversations/*` REST plus
Socket.IO at `/socket.io`. You attach meaning with `subjectType` / `subjectId` / `metadata`, read
conversations through `MESSAGING_PROVIDER` (membership-checked), and emit your own namespaced events
to the same authorised rooms via `REALTIME_BROADCASTER`. Identity, tenant and permissions always come
from the JWT, never the payload. Seeded permissions: `read:conversation`, `create:conversation`,
`send:message`, `moderate:message`. Rules and details: `core/messaging/README.md`,
`docs/messaging.md`. First consumer: Atlas `conversation-intelligence`.

---

## 13. The web client

Any frontend can talk to the API: `/api/*`, Bearer JWT, every error is
`{ error: { code, message, details } }`. In this repo the React apps share transport code:

- **`@auric/web`** (`packages/web`, source-only): `createHttpClient` (bearer + one retry through a
  refresh on 401), `createTokenStore`, `createRefresher` (**single-flight** — refresh tokens are
  single-use and reuse revokes the session), `ApiError`. Alias it in `vite.config.ts` and tsconfig
  `paths` (see `atlas/web/vite.config.ts`). You keep your own endpoints, claim shape, storage key and
  domain clients.
- **Messaging types**: alias `@auric/contracts/messaging` →
  `core/messaging/contracts/index.ts` (types + realtime event constants, no runtime deps).
- **Locale**: default `ar`, RTL, `ar-EG` formatting in `Africa/Cairo` — mirror `core/localization`.
- **Frontend `can()` is UX only.** The backend is the security boundary.
- If you deploy on Vercel, enable "Include source files outside of the Root Directory" (the app
  imports `../../packages` and `../../core/...`).

Auth flow the client implements: `POST /auth/login` (optional `organizationId`) → `{ user, tokens,
organizations }`; the access token's `org` claim is `string | null` (an org-less token is valid only
on `/me`, list/create orgs); switch tenant with `POST /auth/refresh { organizationId }`.

---

## 14. Testing

| Kind | How |
|---|---|
| Domain | pure unit tests, no DB |
| Integration | boot your module against a **throwaway Postgres**: `AURIC_TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5432/auric_test`; skipped without a DB in CI). The schema is reset/migrated as owner but the app runs as `auric_app`/`auric_system` so RLS is genuinely exercised. Helpers: `core/tests/helpers.ts`. |
| Must-have cases | unauthorised action blocked · permission change takes effect · **tenant A ⊗ tenant B** · RLS not bypassable · event delivered once |
| AI | `ScriptedAiClient` (`core/assistant/tests`) — no live LLM; per-tool cross-tenant + permission-deny |

`vitest` runs integration suites serially (`fileParallelism: false`). Ship domain + use-case +
repository/integration + API tests **before** wiring a module into the root.

---

## 15. Deploy

Per product: own systemd unit, own port, own `.env`, own database; nginx location or subdomain in
front; web on its own host. Steps: build (`npm run build`) → copy `dist/` → `prisma migrate deploy`
runs at boot via your `migrate` → `provision-db` once per database. Reference:
`docs/deployment.md` (Mizan), `docs/atlas-deployment.md` (Atlas on the same VPS, separate database).

---

## 16. Rules you must not break

1. **No product words in `core/`.** If a Core change names a Matter, Lead or Invoice, it belongs in
   your product.
2. **Depend on tokens and `core/contracts`,** never on Core's tables or internal classes.
3. **One database and one JWT secret per product.**
4. **Every table you own: `organization_id NOT NULL` + RLS.** Never rely on `WHERE` alone.
5. **The use case owns the transaction.** Audit and publish inside it.
6. **Authorise on the backend, on permissions, not role keys.**
7. **External side effects go through the outbox** (`onExternal`), and handlers are idempotent.
8. **Don't pre-build for "the next client".** Rule of Three: extract into Core only after a second
   product has independently written the same thing. Record it in `docs/core-extractions.md`,
   including what you chose not to extract.
9. **No new infrastructure without a requirement** (Redis, search engine, microservices, plugins).
10. **A Core change ships only with all products' tests green,** and any Core table change needs a
    migration copied into **every** product's Prisma project.

## 17. Common mistakes

| Symptom | Cause |
|---|---|
| Queries return nothing / RLS errors | Read outside `readInTenant`/`uow.transaction`; or an org-less token on a tenant route |
| RLS "doesn't work" locally | Only `AURIC_DATABASE_URL` set → superuser bypasses RLS. Provision and use `auric_app` |
| Missing `x-correlation-id`/locale handling, raw error bodies | Forgot `RequestContextMiddleware` / `AppExceptionFilter` in your root module |
| `Nest can't resolve dependencies` / weird type errors on Fastify | A second `node_modules` inside the product (dual-package hazard) |
| Boot migrates the wrong database schema | Used Core's `migrateToLatest` (root Prisma project) instead of your own `scripts/migrate.ts` |
| `403` on a route you just added | Permission not in the seed, or the role doesn't hold it; check `/api/me` perms |
| Assistant DI errors | Provided `ASSISTANT_TOOLS` etc. in a different module than `AssistantService` |
| Duplicate external handler error at boot | `onExternal` handler name registered twice for one event |
| Email re-sent / LLM called twice | External handler not idempotent (delivery is at-least-once) |

---

## 18. Where to read next

`docs/CORE.md` (overview) · `core/README.md` and `core/<module>/README.md` (contracts) ·
`docs/tenancy.md` · `docs/conventions.md` · `docs/integration-guide.md` (older, Plan-era; this file
supersedes its "pinned package" wording) · `docs/core-extractions.md` · `docs/deployment.md` ·
`docs/atlas-deployment.md` · `mizan/backend/app/README.md` and `atlas/backend/app/` as worked
examples.
