# AURIC Core — Integration Guide

How to build on Core in a client project (Plan §13), and how to add a module.

## Using Core in a client project

Core is consumed as a versioned internal package, pinned per project
(Plan §10.3, §11.2). A client repo:

Core is a NestJS app. A client repo builds its own `AppModule` that imports the
Core feature modules it needs, plus its own domain modules:

```ts
import { Module } from "@nestjs/common";
import {
  KernelModule, EventsModule, IdentityModule, RbacModule,
  OrganizationsModule, AuditModule, NotificationsModule, FilesModule,
} from "@auric/core";
import { EmployeeModule } from "./employee/employee.module.js";

@Module({
  imports: [
    KernelModule, EventsModule, IdentityModule, RbacModule,
    OrganizationsModule, AuditModule, NotificationsModule, FilesModule,
    EmployeeModule,          // client domain
  ],
})
export class ClientAppModule {}
```

Client `main.ts` migrates, then `NestFactory.create(ClientAppModule,
new FastifyAdapter())`. Domain code injects the Core contracts by token:
`@Inject(USER_PROVIDER)`, `@Inject(PERMISSION_PROVIDER)`,
`@Inject(NOTIFICATION_PROVIDER)`, `@Inject(FILE_STORAGE)`, `@Inject(EVENT_BUS)`,
`@Inject(TENANT_CONTEXT)`.

Client-specific domain code lives in the client repo (Plan §10.1 `app/`), not
in Core. It depends on the contracts, never on Core's tables.

## The provider interfaces (Plan §4)

A client/domain module never does `SELECT … FROM users`. It takes the
interface it needs and calls it:

| Interface | Get a user, check existence |
|---|---|
| `IUserProvider` | `getUser(id)`, `userExists(id)` |
| `IOrganizationProvider` | `getOrganization(id)`, `isMember(orgId, userId)`, `membershipsForUser(userId)` |
| `ITenantContext` | `organizationId()` (throws if none), `organizationIdOrNull()` — the active tenant (docs/tenancy.md) |
| `IPermissionProvider` | `can(userId, action, resource)`, `assignRole`, `permissionsFor` — resolved within the active tenant |
| `INotificationProvider` | `send({ userId, templateKey?, channels })` |
| `IFileStorage` | `upload`, `getUrl`, `getContent`, `delete` |
| `IAuditLogger` | `record({ actorId, action, resourceType, before, after })` |
| `IEventBus` | `publish(event)` |

## Adding a domain module (e.g. an `app/employee`)

Follow the module anatomy (Plan §3.2):

```
employee/
├── domain/            Employee entity + rules (no SQL, no HTTP, no Nest)
├── application/       @Injectable use cases — each owns its transaction
├── infrastructure/    @Injectable repositories via `currentExecutor()`; provider impls
├── api/               @Controller; handlers stay thin
├── events/            events it publishes (employee.created, …) + subscribers
├── permissions/       PermissionDefinition[] it contributes to RBAC
├── validation/        Zod schemas
├── employee.module.ts @Module wiring the above
└── tests/
```

Register subscribers in the module's `OnModuleInit`; contribute the module's
`PermissionDefinition[]` to the client's seed step.

The module's tables are a `prisma/schema/employee.prisma` model (`@@map` to
keep snake_case names); its migration is Prisma-owned in `prisma/migrations/`.

Rules that keep it forkable and decoupled:

1. **Own your data, reference the rest.** Store `userId`; get the user via
   `IUserProvider`. Never duplicate identity.
2. **Use cases own the transaction.** Wrap the operation in
   `unitOfWork.transaction(async () => { … })`; call repositories, audit, and
   `events.publish()` inside it.
3. **Publish, don't call.** To trigger work in another module, publish
   `employee.created`; don't import that module.
4. **Pick the right event delivery.** DB-only reaction →
   `registry.onInProcess`. Anything external (email, e-invoice, webhook) →
   `registry.onExternal` so it goes through the outbox. Do not add the outbox
   anywhere else (Plan §6.1).
5. **Declare permissions.** Export `PermissionDefinition[]`; they get seeded so
   `can(user, "employee:create", "employee")` resolves.
6. **Schema in Prisma.** Add the model to `prisma/schema/employee.prisma`,
   `npm run migrate:dev -- --name add_employee`, then hand-add any CHECK
   constraint / trigger / partial index to that migration. `npm run db:generate`
   updates the Kysely types.

## Integrations & compliance are NOT localization (Plan §7.11, §12B)

ETA e-invoicing, local payment gateways, SMS providers — these are **adapters**
added when a real project needs them, living behind an interface in an
`infrastructure/` or an adapters layer, invoked as external-effect events
through the outbox. They do not go in `core/localization`, which is only
language, direction, and formatting.

## The Prisma cutover (done)

Plan §2 makes Prisma the owner of the schema definition and migration history,
with its generated types feeding Kysely's `Database` interface. Prisma Client
is **not** used for runtime queries — Kysely stays. This is now in place.

### Runtime

Node 24 (via nvm; `.nvmrc` pins it, `package.json` `engines` is
`^22.12 || >=24` — Prisma won't install on odd majors like 23.x).

### Schema definition

- `prisma@7` (a runtime `dependency` — `core.migrate()` shells its CLI) +
  `prisma-kysely@3` (dev, codegen only). Config is `prisma.config.ts` (loads
  `.env`, datasource URL from `AURIC_DATABASE_URL`). Prisma 7 dropped `url` from
  the schema datasource block and gates `extensions = [...]` behind a preview
  feature, so `citext` is created by the baseline migration, not declared in the
  datasource.
- `prisma/schema/` is split by module (`identity.prisma`, `rbac.prisma`, …);
  models mirror the tables (`@@map` / `@map` keep the names). Columns Prisma
  can't type precisely (string-union CHECK columns, JSONB payloads,
  `files.byte_size` as `number`) carry a `/// @kyselyType(...)` annotation.
- `prisma-kysely` writes `core/kernel/db/schema.ts` with `dbTypeName =
  "Database"`, so `db.ts` is unchanged. `core/kernel/db/json.ts` holds the
  hand-written `Json<T>` helper the generated file imports (generator `banner`).
- `npm run db:generate` regenerates; `npm run db:pull` re-introspects.

### Migrations

- `prisma/migrations/` holds two migrations: `…_baseline` (the full v0.1 schema,
  generated by `prisma migrate diff`, with `CREATE EXTENSION citext` prepended)
  and `…_constraints_triggers_indexes` (hand-written: the six CHECK constraints,
  `auric_set_updated_at` + its four per-table triggers, the `audit_logs`
  append-only trigger, the `outbox_ready_idx` partial index).
- `core/kernel/db/migrate.ts` runs `prisma migrate deploy` as a child process
  with `AURIC_DATABASE_URL` set to the caller's DB. `core.migrate()`,
  `npm run migrate` / `migrate:status`, and a standalone `prisma migrate deploy`
  in CI all drive the same `_prisma_migrations` state.
- The Kysely migrator, `migrations-manifest.ts`, the per-module `migrations/`
  folders, and `db/bootstrap/` are gone. `scripts/migrate.ts` is now a thin
  wrapper over `prisma migrate deploy` / `status`; there is no `migrate:down`
  (Prisma rolls forward).
- An existing Kysely-migrated database is baselined with
  `prisma migrate resolve --applied <name>` for each migration (drop the old
  `auric_migrations` / `auric_migrations_lock` tables first).

None of this touches a use case, a contract, or the event system — the
boundaries that matter are ORM-agnostic.

## Upgrading Core in a client (Plan §11.3)

Pinned. Core changes never auto-flow. Bumping the pinned version is scheduled,
tested maintenance work; security patches get priority windows.
