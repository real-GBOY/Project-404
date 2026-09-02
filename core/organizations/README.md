# `core/organizations` — organizations & membership (the tenant)

## 1. What it is

Organizations and their members (Plan §7.4). In the multi-tenant design
(`docs/tenancy.md`) **an organization *is* the tenant** — there is no separate
`tenants` table. Exposes `IOrganizationProvider`: get an org, check membership,
list a user's memberships.

## 2. Why it exists

Multi-tenant applications need a first-class "which company is this" concept that
owns every tenant-scoped record. Making that concept the organization (rather
than a parallel tenant abstraction) keeps the model simple and the SQL honest.

## 3. What problem it solves

- A single owner for `organization_id` on every tenant table.
- The membership list login needs to resolve the active tenant and to power the
  org switcher.
- Org-scoped settings (`settings jsonb`) without a bespoke table per product.

## 4. Responsibilities

- `OrganizationProvider` (`IOrganizationProvider`): `getOrganization(id)`,
  `isMember(orgId, userId)`, `membershipsForUser(userId)`.
- `OrganizationService` use cases: create org, update org settings, add/remove a
  member with a membership role — each audited and event-publishing.
- Guarantee `slug` uniqueness.

## 5. What it owns

Tables: `organizations`, `organization_members`
(`prisma/schema/organizations.prisma`). The `Organization` and
`OrganizationMembership` public shapes. The org-scoped `settings` blob's storage
(not its meaning).

## 6. What it explicitly does NOT own

- **`ITenantContext`** — that lives in `core/kernel/tenant.ts`. Organizations
  deliberately stays free of *request* tenant context: it answers "who is a
  member", not "who is the caller".
- **RLS policy definitions** — those are in each table's Prisma migration.
- **User accounts** (`core/identity`).
- **Permissions** — a `membershipRole` string is *not* an RBAC role; RBAC
  assignments are separate and tenant-scoped (`core/rbac`).
- Billing/plans/quotas per org — added only when a real SaaS requirement appears.

## 7. Public surface

- `OrganizationsModule` — exports token `ORGANIZATION_PROVIDER`
  (`IOrganizationProvider`).
- HTTP (`/api/organizations`): `POST /`, `GET /:id`, `PATCH /:id/settings`,
  `GET /:id/members`, `POST /:id/members`, `DELETE /:id/members/:userId`.

## 8. How to use

```ts
constructor(@Inject(ORGANIZATION_PROVIDER) private readonly orgs: IOrganizationProvider) {}

// at login (core/identity does this):
const memberships = await this.orgs.membershipsForUser(userId);

// a guard confirming the caller belongs to the org they claim:
if (!(await this.orgs.isMember(orgId, userId))) throw Forbidden(…);
```

Everywhere else, do **not** call this — RLS + the `organization_id` column scope
the data automatically.

## 9. Dependencies & direction

Imports `AuditModule`, `EventsModule`, `forwardRef(IdentityModule)` (breaks the
identity ↔ organizations cycle: login reads memberships; adding a member checks
the user exists). Consumed by `core/identity` and by anything that must name the
tenant.

## 10. Invariants

1. An organization **is** the tenant — no separate tenant entity, ever.
2. `IOrganizationProvider` takes no tenant context — it is a membership registry.
3. `slug` is globally unique and URL-safe.
4. A `membershipRole` (`owner`, `member`, …) is coarse metadata; **authorization
   uses RBAC**, not this field.
5. Removing the last member / owner of an org is a use-case rule, not something
   callers work around with raw SQL.

## 11. Example — the tenancy boundary

```
IOrganizationProvider   →  "is user U a member of org O?"           (this module)
ITenantContext          →  "which org is THIS request acting as?"   (core/kernel)
organization_id column  →  "which org owns THIS row?"               (every tenant table)
PostgreSQL RLS          →  enforces the row above matches the context
```

## 12. Testing expectations

`core/organizations/tests/` + `core/tests/`: duplicate slug rejected;
`membershipsForUser` returns exactly the user's orgs; a non-member is refused;
member add/remove is audited; **tenant A cannot read tenant B's org or members**
even with a forged org id in the request.

## 13. When NOT to extend it

- To add request/tenant-context resolution — that is kernel's job.
- To add plans, seats, quotas, or invoicing without a real SaaS requirement.
- To treat `membershipRole` as a permission.
