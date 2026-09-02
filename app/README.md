# `app/` — Mizan (Project #1), the client application

This directory is the **actual product** built on the AURIC Foundation:
**Mizan** (codename *Project 404*), a law-firm management system for
Tawfik & Partners. It is Project #1 in AURIC's build → use → extract loop
(`Plan.md` §8, §10.1).

The running deployable is **Mizan**, *powered by* AURIC Core — it is not "Core".
Mizan is **one product with (currently) two parts**: this backend domain
(`app/lawfirm/`) and the web client (`web/`); a mobile client is Phase 2. All
parts speak to the same API.

```
                 REPOSITORY
                     │
         ┌───────────┴────────────┐
         │                        │
   AURIC FOUNDATION         CLIENT APPLICATION  (Mizan)
      core/                 ┌───────┴────────┐
   platform, reused,        app/lawfirm/     web/  (mobile/ later)
   versioned, generic       law-firm domain  law-firm UI
```

---

## 1. What it is

The Mizan backend: one NestJS bounded module per law-firm feature — clients,
matters, hearings, tasks, documents, billing, staff, settings, dashboard — plus
the composition root (`app.module.ts`), the layered seed (`seed.ts`), and the
product version (`version.ts`). Each mature feature grows the full anatomy:
`domain/ application/ infrastructure/ api/ events/ permissions/ validation/
tests/ feature.module.ts`.

## 2. Why it exists

To build **one excellent real application** on a strong foundation. The first
goal is not a generic ERP platform — it is Mizan, done properly, with clean
boundaries so the reusable parts can be extracted *later* (Plan §50).

## 3. What problem it solves

- A real, opinionated law-firm product for a real client.
- A concrete first consumer that proves (and pressure-tests) Core's contracts.
- The first data point for the Rule of Three — after two more real client builds,
  repeated patterns here become extraction candidates.

## 4. Responsibilities

- The law-firm **domain**: business concepts and rules for Client, Matter,
  Hearing, Task, Document, Invoice, Payment, Expense, Staff — no framework in the
  domain layer.
- **Use cases** owning their transaction boundary: `authn → validate → transaction
  → persist → publish event`.
- **Infrastructure**: Kysely repositories, providers, adapters.
- **Thin API controllers** under `/api`.
- Multi-tenant scoping: every lawfirm table has `organization_id NOT NULL` +
  `tenant_isolation` RLS; child tables use a composite FK to the parent, not
  triggers (decision #5).
- The **Mizan seed layer** (law-firm permissions + starting roles).

## 5. What Mizan owns

Law-firm concepts and their tables (`prisma/schema/lawfirm-*.prisma`): **Client,
Contact, Matter, Participant, MatterUpdate, Note, Hearing, Task, Document
(metadata), Invoice, InvoiceLine, Payment, Expense, StaffProfile, CalendarEvent,
LawFirmSettings, lawfirm_activity_entries, lawfirm_reminders**. The law-firm
permission keys and the roles `firm_admin, partner, lawyer, paralegal, finance,
read_only` (seeded into Core RBAC, editable via `/api/rbac`). All Mizan product
copy and UX.

## 6. What Mizan explicitly does NOT own

- Anything in `core/` — identity, RBAC evaluation, organizations/tenancy, files
  (bytes), the audit trail, the notification pipeline, the event/outbox system.
- The `web/` design-system primitives (those are Mizan's *web* concern, in
  `web/`, but still "infrastructure the product is built from").
- Reusable modules. A `lawfirm/<area>/` folder being a clean, fully-anatomised
  module does **not** make it an AURIC module — it is Client #1's domain, built
  properly (see §13).

## 7. Public interfaces Mizan consumes (the Core ↔ Mizan boundary)

```
core/  ──X──▶  app/        Core MUST NOT import from app/.  (verified: grep is empty)
app/   ─────▶  core/       Only through Core's public contracts / DI tokens.
```

Domain code reaches Core **by token, typed as the interface** — never a Core
table or concrete class:

| Token | Interface | Used for |
|---|---|---|
| `USER_PROVIDER` | `IUserProvider` | show "assigned to …", validate an actor |
| `ORGANIZATION_PROVIDER` | `IOrganizationProvider` | membership checks |
| `TENANT_CONTEXT` | `ITenantContext` | the few paths that must name the tenant |
| `PERMISSION_PROVIDER` | `IPermissionProvider` | gate every write |
| `NOTIFICATION_PROVIDER` | `INotificationProvider` | notify users of domain events |
| `FILE_STORAGE` | `IFileStorage` | store document bytes |
| `AUDIT_LOGGER` | `IAuditLogger` | audit sensitive operations |
| `EVENT_BUS` | `IEventBus` | publish domain events |
| `UNIT_OF_WORK`, `CLOCK` | — | transactions, time |

**Core must remain unaware of client-domain concepts** — it must not know what a
Matter, Hearing, Lawyer, Client, or Invoice is, and must not contain law-firm
permissions or roles.

**The one sanctioned exception:** `app/seed.ts` imports `RbacRepository` and
`parsePermissionKey` from `core/rbac` to write the law-firm permissions/roles at
boot. Seeding is inherently a Core-internals operation and belongs to the
composition root; `RbacRepository` is on `RbacModule`'s public exports. No
*domain module* reaches past `core/contracts`.

## 8. How the parts fit — composition

```
main.ts → NestFactory.create(AppModule, new FastifyAdapter())
AppModule
  ├── Core modules   KernelModule · EventsModule · IdentityModule · RbacModule
  │                  OrganizationsModule · AuditModule · NotificationsModule · FilesModule
  └── LawfirmModule
        ├── ClientsModule · MattersModule · HearingsModule · TasksModule
        ├── DocumentsModule · BillingModule
        └── StaffModule · SettingsModule · DashboardModule
```

`core/app.module.ts` is retained **only** as the fixture for Core's own
integration tests. The running composition root is `app/app.module.ts`.

### Two seed layers (not one)

`AppSeedService` runs them in order on every boot, idempotently:

| Layer | Owner | Seeds |
|---|---|---|
| Core seed (`SeedService`) | AURIC Foundation | platform permissions + `admin` wildcard role + Core notification templates |
| Mizan seed (`AppSeedService`) | this app | law-firm permissions (`create:matter`, `record:payment`, …) + roles (`firm_admin`, `partner`, `lawyer`, `paralegal`, `finance`, `read_only`) |

So the platform has *N* permissions and Mizan adds *M* — never "AURIC has N+M".
**No domain code branches on a role key — only on permissions.**

## 9. Dependencies & direction

```
AURIC CORE  ◀──  MIZAN (app/lawfirm)  ◀──  { web/, mobile/ }
```

Mizan depends on Core (through contracts). `web/`/`mobile/` depend on Mizan's
API. Nothing flows the other way.

## 10. Invariants

1. Mizan lives in `app/lawfirm/` (Plan §47 rule 3).
2. Domain code consumes Core only via `core/contracts` + tokens.
3. Controllers are thin; logic is in domain/application.
4. Backend authorization is authoritative; every write is permission-gated.
5. Tenant isolation = `organization_id NOT NULL` + PostgreSQL RLS; child-table
   mismatch is blocked by a composite FK to the parent, not triggers.
6. Financial calculation is server-authoritative (invoice fees + disbursements +
   VAT − payments); `payment.currency` must equal `invoice.currency`; no
   overpayment past balance. Multi-currency has **no FX** — per-currency arrays.
7. Every phase ships domain + use-case + repo/integration + API + authz +
   tenant-isolation + event/outbox tests, proving **Tenant A ⊗ Tenant B**.

## 11. Example — a use case consuming Core

```ts
async close(actorId: string, matterId: string) {
  if (!(await this.perms.can(actorId, "close", "matter")))
    throw Forbidden("matter.forbidden", "You can't close matters.");

  return this.uow.transaction(async () => {
    const matter = await this.repo.get(matterId);   // RLS-scoped to the active tenant
    matter.close(this.clock.now());
    await this.repo.update(matter);
    await this.audit.record({ actorId, action: "matter.closed", resourceType: "matter", resourceId: matterId });
    await this.events.publish(matterClosed({ matterId }));   // Core delivers side effects via the outbox
    return matter.toPublic();
  });
}
```

## 12. Testing expectations

Per feature phase (Plan / `web/PLAN.md` §18): domain unit + use-case +
repo/integration + API + authz + **tenant-isolation** + event/outbox tests.
Critical assertions: unauthorized action blocked, permission change takes effect,
RLS cannot be bypassed, Tenant A cannot see Tenant B, financial rules hold
(currency match, no overpayment). Demo data is a separate opt-in seeder — real
production paths stay empty and their empty states are implemented.

## 13. Extraction — not yet

Do **not** extract anything into `modules/` or into Core prematurely. A
capability becomes an extraction candidate only after it has been implemented
across **three** real, different client projects and its stable reusable shape is
visible (`Plan.md` §8, §10.2 — the Rule of Three). Eventual *candidates* (not
promises): Documents, Tasks, CRM/Clients, Billing, Approvals. **Stays
client-specific**: Matters, Hearings, court/lawyer workflows, legal terminology
and rules. Until the third build, the next client forks the nearest prior build.
