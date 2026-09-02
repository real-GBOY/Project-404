# AURIC Core

> The reusable, domain-agnostic foundation. **Core knows nothing about law
> firms.** Everything client-specific lives in `app/` (Mizan) and `web/`.

This README is the **architectural contract for `core/` as a whole**. Every
reusable module under `core/` carries its own `README.md` documenting *its*
contract to the same shape.

---

## 1. What it is

A NestJS (Fastify adapter) modular-monolith library of cross-cutting platform
capabilities — identity, RBAC, organizations/tenancy, files, audit,
notifications, events, localization, observability — plus the kernel primitives
and the provider interfaces (`core/contracts`) those capabilities are consumed
through.

## 2. Why it exists

So that the *next* client application after Mizan does not re-implement auth,
permissions, tenancy, file storage, an audit trail, a notification pipeline, or
an event/outbox system. These are genuinely the same everywhere; the business
domain is not.

## 3. What problem it solves

- One correct implementation of the boring-but-critical infrastructure.
- A hard seam between "platform" and "product" so the product can move fast
  without corrupting the reusable parts.
- A stable set of interfaces (`core/contracts`) that client domain code binds
  to, keeping every domain module forkable and loosely coupled.

## 4. Responsibilities

- Authenticate users; issue and rotate tokens (`identity`).
- Answer *"can this user do this, in this tenant?"* (`rbac`).
- Own organizations and membership; an organization **is** the tenant
  (`organizations`, `kernel/tenant`).
- Store and serve files behind a swappable adapter (`files`).
- Keep an append-only audit trail (`audit`).
- Deliver templated, bilingual in-app + email notifications (`notifications`).
- Publish domain events in-process and drive external side effects through a
  transactional outbox + worker (`events`).
- Provide locale/direction resolution and `ar-EG` formatting (`localization`).
- Provide structured logging, correlation IDs, health + readiness
  (`observability`, `http`).
- Provide config, clock, id generation, the unit-of-work, DI tokens, and error
  types (`kernel`).

## 5. What Core owns

Platform concepts and their tables: **User, RefreshToken, VerificationToken,
Organization, OrganizationMember, Role, Permission, RolePermission,
UserRoleAssignment, File, AuditEntry, Notification, NotificationTemplate,
OutboxMessage**. Schema for these lives in `prisma/schema/<module>.prisma`.

## 6. What Core explicitly does NOT own

- Any business/domain concept: **Matter, Hearing, Lawyer, Client, Invoice,
  Payment, Expense, Task, Court** — Core must not know these words exist.
- Law-firm permissions or roles. Core seeds only *platform* permissions
  (`read:organization`, `manage:role`, …) and the wildcard `admin` role; Mizan
  seeds `create:matter`, `firm_admin`, etc. (see `core/bootstrap/README.md` and
  `app/README.md`).
- The production composition root. `core/app.module.ts` exists **only** as the
  fixture for Core's own integration tests. The running root is
  `app/app.module.ts`.
- Frontend code. Core has no knowledge of `web/`.
- Vendor lock-in: no direct S3/Cloudinary/Elasticsearch/Redis calls — always
  behind an adapter/interface, added only when a real requirement appears.

## 7. Public surface

`core/index.ts` re-exports:

- **Feature `@Module`s**: `KernelModule`, `EventsModule`, `AuditModule`,
  `RbacModule`, `IdentityModule`, `OrganizationsModule`, `NotificationsModule`,
  `FilesModule`, `SecurityModule`.
- **DI tokens** (`core/kernel/tokens.ts`): `CONFIG`, `CLOCK`, `UNIT_OF_WORK`,
  `USER_PROVIDER`, `ORGANIZATION_PROVIDER`, `PERMISSION_PROVIDER`,
  `NOTIFICATION_PROVIDER`, `FILE_STORAGE`, `AUDIT_LOGGER`, `EVENT_BUS`,
  `TENANT_CONTEXT`, …
- **Provider interfaces** (`core/contracts`): `IUserProvider`,
  `IOrganizationProvider`, `ITenantContext`, `IPermissionProvider`,
  `INotificationProvider`, `IFileStorage`, `IAuditLogger`, `IEventBus`,
  `DomainEvent`, `defineEvent`.
- **Bootstrap**: `SeedService`; **migrations**: `migrateToLatest`,
  `migrationStatus`; **tenancy helpers**: `requireOrganizationId`,
  `tenantContext`, …

HTTP surface (mounted under `/api` by the composition root): `auth/*`, `me`,
`rbac/*`, `organizations/*`, `files/*`, `audit-logs`, `notifications/*`,
`health`, `health/ready`.

## 8. How a client application uses Core

```ts
// app/app.module.ts (the running composition root)
import {
  KernelModule, EventsModule, IdentityModule, RbacModule,
  OrganizationsModule, AuditModule, NotificationsModule, FilesModule,
} from "@auric/core";
import { LawfirmModule } from "./lawfirm/lawfirm.module.js";

@Module({
  imports: [
    KernelModule, EventsModule, IdentityModule, RbacModule,
    OrganizationsModule, AuditModule, NotificationsModule, FilesModule,
    LawfirmModule,            // ← the Mizan domain
  ],
})
export class AppModule {}
```

Domain code injects Core **by token, never by concrete class**:

```ts
constructor(
  @Inject(USER_PROVIDER)         private readonly users: IUserProvider,
  @Inject(PERMISSION_PROVIDER)   private readonly perms: IPermissionProvider,
  @Inject(NOTIFICATION_PROVIDER) private readonly notify: INotificationProvider,
  @Inject(TENANT_CONTEXT)        private readonly tenant: ITenantContext,
) {}
```

See `docs/integration-guide.md`.

## 9. Dependencies & allowed direction

```
AURIC CORE  ◀──  MIZAN (app/lawfirm)  ◀──  { web/, mobile/ }
```

- **Core → app/**: forbidden. Verified: `grep -rn "app/lawfirm" core/` is empty.
- **Core → web/**: forbidden.
- **app/ → Core**: allowed, through `core/contracts` interfaces and the exported
  `@Module`s / tokens. Reaching into `core/<module>/domain|application|
  infrastructure` from domain code is forbidden (the one sanctioned exception is
  the seed script — see `core/bootstrap/README.md`).
- **Inside Core**: modules depend on `kernel` + `contracts` + `events` + `audit`
  freely. Cross-feature dependencies are minimised and always go through the
  other module's token, never its repository — except `identity ↔ organizations`
  which is a deliberate `forwardRef` cycle (login needs memberships; membership
  writes need a user).

## 10. Invariants

1. Core stays domain-agnostic. If a symbol names a business concept, it is in the
   wrong place.
2. No feature enters Core until a real project needs it **and** its shape is
   understood (Plan §0). "Might be reusable" is not a reason.
3. Domain modules consume Core only through `core/contracts` + tokens.
4. Every use case owns its transaction: `authn → validate → transaction →
   persist → publish event`. The event bus does not open transactions.
5. Backend authorization is the security boundary. Frontend `can()` is UX only.
6. Tenant isolation is enforced by PostgreSQL RLS + `organization_id NOT NULL`,
   not by hand-written `WHERE` clauses.
7. DB constraints stay authoritative (`NOT NULL`, `UNIQUE`, `CHECK`, `FK`,
   composite FK, RLS, triggers).
8. Prisma owns schema + migration history; Kysely is the runtime query builder.

## 11. Testing expectations

- **Unit**: domain logic runs with no DB (pure).
- **Integration** (`core/tests/`): boot Core against a throwaway Postgres
  (`AURIC_TEST_DATABASE_URL`). Cover: unauthorized action blocked, permission
  change takes effect, **tenant A ⊗ tenant B** isolation, RLS cannot be
  bypassed, outbox delivers exactly once.
- A new Core module ships domain + use-case + repository/integration + API tests
  before it is wired into the composition root.

## 12. When NOT to extend Core

- To host anything Mizan-specific — that goes in `app/lawfirm/`.
- To pre-build a capability "for the next client" — wait for the requirement.
- To extract a Mizan module (Documents, Tasks, Billing, …) after **one**
  project. The bar is **three** real client builds with a stable shared shape
  (Plan §8, §10.2 — Rule of Three). Until then the next client forks the
  nearest prior build.
