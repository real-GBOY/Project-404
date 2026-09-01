# AURIC Core — Multi-Tenancy (design)

**Status: implemented (2026-09-01).** This is the design of record. `architecture.md`
→ *Multi-tenancy*, `conventions.md` → *Database*, `core/contracts/index.ts`, and
`Plan.md` §7.3 have been updated to match. The rollout section at the end is kept
as the historical build order; the amendments block just below records the four
points that changed during implementation.

### Amendments settled during implementation (2026-09-01)

Four points in the original design did not survive contact with the code; these
resolutions supersede the conflicting text further down:

1. **`notifications.organization_id` is `NULLABLE`, not `NOT NULL`.** Registration
   writes a welcome notification for a user who belongs to no org yet.
   Account-level notifications (welcome, security, invitations) carry `NULL` org
   and are visible to the user in any tenant context. Policy:
   `user_id = current_setting('app.user_id', true) AND (organization_id IS NULL
   OR organization_id = current_setting('app.organization_id', true))`.
2. **Login is additive.** `POST /auth/login` accepts an optional
   `organizationId`; it resolves to that org (membership checked), else the sole
   membership, else `null`. The access token's `org` claim is `string | null`; an
   orgless token is valid only on non-tenant routes (`/me`, list orgs, create
   org). `POST /auth/refresh` accepts an optional `organizationId` to switch
   tenants. The login response gains `organizations: [{ id, slug, name,
   membershipRole }]`. The `{ user, tokens }` shape is preserved.
3. **`can()` / permission reads run inside a tenant transaction.** The
   `PermissionGuard` (`CanActivate`) wraps its check in `readInTenant`, because a
   guard otherwise queries the raw pool with no `app.organization_id`.
4. **Any authenticated user may create an organization** and becomes its
   `owner` + tenant-scoped `admin`. The `create:organization` RBAC guard is
   removed from `POST /organizations` (self-service SaaS). In-org permissions
   still gate normally.

DB topology: **two pools** — `auric_app` (no `BYPASSRLS`, normal runtime) and
`auric_system` (`BYPASSRLS`, for signup / webhooks / the outbox worker), plus
`auric_owner` for migrations. `unitOfWork.transaction` routes by `ctx.system`.

## Why now (Plan §0, §7.3)

`Plan.md` §7.3 makes single-tenant the default and calls multi-tenancy "the most
common piece of speculative infrastructure to avoid" — *until a specific product
actually serves many organizations from one instance*. That product now exists:
AURIC is running a shared SaaS, not a per-client deployment. Multi-tenancy is
therefore fundamental infrastructure for this build, and the approach below is
the one §7.3 already prescribed: shared schema, `tenant_id` column, PostgreSQL
Row-Level Security, tenant context per request.

## Decisions (locked)

| Question | Decision | Consequence |
|---|---|---|
| What is a tenant? | **The organization.** `tenant_id` is `organization_id` everywhere — no second concept, no new column name. | `organizations` / `organization_members` become the tenant registry. |
| User identity | **Global.** One `users` row per human, email globally unique. `organization_members` is the tenancy link; a user can belong to many orgs. | Every "current user" concern is now *scoped*, not partitioned. JWT carries an active-org claim. |
| Isolation model | **Shared schema + `organization_id` column + RLS.** | One migration path, cheapest ops. DB-per-tenant stays a future premium tier (§7.3). |
| RBAC scoping (v1) | `roles` / `permissions` / `role_permissions` stay **global** (system-defined). Only `user_roles` gets `organization_id`. | "Alice is admin in org A, viewer in org B" works. Per-tenant *custom* roles are a documented later extension, not v1. |

## The model

```
users ─────────────< organization_members >───────────── organizations
(global identity;      (the tenancy link:                  (= the tenant)
 no organization_id;    user_id + organization_id +
 email_normalized       membership_role)                   every tenant-scoped
 globally unique)                                          table hangs off
                                                           organization_id + RLS
```

- **Global tables** (no `organization_id`, no RLS): `users`, `refresh_tokens`,
  `verification_tokens`, `roles`, `permissions`, `role_permissions`, Prisma
  migration history.
- **Registry tables** (`organizations`, `organization_members`): RLS with
  special-cased policies — they must be readable *before* a tenant is chosen,
  during login.
- **Tenant-scoped tables** (`organization_id NOT NULL` + RLS): `audit_logs`
  (nullable — see below), `notifications`, `files`, `outbox_messages`,
  `dead_letter_messages`, `user_roles`, and every future domain-module table.

## Schema changes

Prisma owns the schema (`prisma/schema/*.prisma`); RLS is hand-carried into the
follow-up migration (`20260829120100_constraints_triggers_indexes` style), since
Prisma can't express policies.

### `user_roles` — gains tenant scope

```prisma
model user_roles {
  user_id         String
  role_id         String
  organization_id String                        // NEW — the tenant the grant applies in
  granted_at      DateTime @default(now()) @db.Timestamptz(6)
  granted_by      String?

  @@id([user_id, role_id, organization_id], map: "user_roles_pk")   // was [user_id, role_id]
  @@index([user_id, organization_id], map: "user_roles_user_org_idx")
  @@map("user_roles")
}
```

`IPermissionProvider.can(userId, action, resource)` and `permissionsFor(userId)`
keep their signatures — they resolve *within the ambient tenant context*, joining
`user_roles` filtered by the current `organization_id`. `guard(action, resource)`
stays a live DB check (per `conventions.md`), now tenant-scoped.

### `audit_logs`, `notifications`, `files`, outbox tables — gain `organization_id`

- `notifications`, `files`, `outbox_messages`, `dead_letter_messages`:
  `organization_id String` **NOT NULL**.
- `audit_logs`: `organization_id String?` **nullable** — system actions (cron,
  the outbox worker, cross-tenant support operations) legitimately have no
  tenant. Nullable rows are invisible to tenant queries and only visible in
  system context. The append-only trigger is unchanged.
- `files`: also namespace the storage key by org (`org_xxx/file_yyy`) for
  defence in depth, so a leaked/guessed key still can't cross tenants.

### Backfill

The existing single-tenant data belongs to one org. Migration: create that org
(or take its id from config), set `organization_id` on every scoped row, then add
the `NOT NULL` and the policies.

### Later extension — per-tenant custom roles (not v1)

When a tenant needs roles it defines itself: add `organization_id String?` to
`roles` and `role_permissions` (NULL = system template, visible to all tenants;
non-null = that tenant's own). Reads: `organization_id IS NULL OR organization_id
= current_setting(...)`. Writes (`WITH CHECK`): `organization_id = current_setting(...)`.
Unique keys become partial indexes split on `organization_id IS NULL`.

## Row-Level Security

RLS is the backstop: a forgotten `WHERE organization_id = …` in Kysely code
**cannot** leak across tenants, because the database refuses to return or write
the rows.

### Database roles

| Role | Used by | RLS |
|---|---|---|
| `auric_owner` | migrations (`prisma migrate deploy`), integration-test schema reset | owns the tables; migrations need DDL |
| `auric_app` | the running application (`AURIC_APP_DATABASE_URL`) | **not** owner, **not** superuser, **no `BYPASSRLS`** — fully subject to policies |
| `auric_system` | signup, billing webhooks, the outbox worker, support tooling | `BYPASSRLS` — a small, audited set of code paths |

Every scoped table gets `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL
SECURITY`, so even `auric_owner` is filtered in dev/test — this catches leaks
during development instead of in production. Config gains a second connection
string; `pool.ts` uses `AURIC_APP_DATABASE_URL`, `migrate.ts` uses
`AURIC_DATABASE_URL`.

### Policy shape

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON notifications
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
```

- `current_setting('app.organization_id', true)` — the `true` returns `NULL`
  instead of erroring when the setting is absent. `NULL = anything` is `NULL`, so
  **no rows match** when context is missing: the safe default is "see nothing",
  never "see everything".
- `WITH CHECK` is not optional — without it a bug could *write* a row tagged with
  another tenant's id.
- `audit_logs` uses the same `USING`/`WITH CHECK`; its nullable `organization_id`
  means system-written rows are simply never visible to a tenant.

### The two special tables

Login needs to read membership *before* an org is selected, so `app.user_id` is
always set alongside `app.organization_id`:

```sql
-- organization_members: your own memberships, or any member of the active org
CREATE POLICY member_visibility ON organization_members
  USING (user_id = current_setting('app.user_id', true)
      OR organization_id = current_setting('app.organization_id', true));

-- organizations: any org you are a member of
CREATE POLICY org_visibility ON organizations
  USING (id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = current_setting('app.user_id', true)
  ));
```

## Request context & `SET LOCAL`

The per-request context already exists: `core/kernel/logging/context.ts`'s
`RequestContext` carries `correlationId` and an optional `userId`, and the logger
mixin already reads it. Extend it — do **not** add a parallel `AsyncLocalStorage`:

```ts
export interface RequestContext {
  correlationId: string;
  userId?: string;
  organizationId?: string;   // NEW — the active tenant
  system?: boolean;          // NEW — true for signup / worker / support paths
  locale?: string;
}
```

`JwtAuthGuard` verifies the JWT, checks the `org` claim, and calls
`patchContext({ userId, organizationId })`.

The context is pushed into Postgres **per transaction**, in
`core/kernel/db/db.ts`'s `unitOfWork.transaction`, right after the transaction
opens and before `fn(trx)`:

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
never bleed into the next pool checkout. This is also why **pgBouncer in
transaction-pooling mode is safe**; session-level `SET` would not be.

### The non-transaction read path — the one gotcha

`currentExecutor()` returns the raw pool when not inside `unitOfWork.transaction`.
Under RLS a pooled connection with no `app.organization_id` set sees **nothing**.
Rule: **every tenant-scoped query runs inside `unitOfWork.transaction`**, reads
included. Single-statement reads get a thin `readInTenant(fn)` helper that opens a
trivial transaction. Revisit only if the ceremony proves painful.

## Tokens & tenant switching

- **Access token** (`AccessTokenClaims` in `jwt-service.ts`) gains `org: string`
  — the active tenant. `perms` becomes the permission set *for that user in that
  org*.
- **Refresh token** stays global (no `org`) — it belongs to a person + device,
  not a tenant. It stays opaque, hashed, rotated, family-revoked on reuse.
- **Switching tenants = refresh with a target org.** `POST /api/auth/refresh`
  accepts `{ organizationId }`, verifies the refresh token, verifies membership,
  and mints an access token with that `org` and the recomputed `perms`. No
  re-login.
- `GET /api/auth/session` (or the login response) lists the caller's orgs so the
  client can render a switcher.

## System context

Paths that legitimately cross or precede tenants run with `system: true` in
context (which skips the `SET LOCAL`) on a connection using the `auric_system`
role:

- **Signup / create-organization** — no tenant exists yet.
- **Billing / provider webhooks** — the tenant is derived from the payload.
- **The outbox worker** — it iterates rows across all tenants. It must
  `set_config('app.organization_id', <row.organization_id>, true)` **per message**
  before invoking that message's handlers, so handler code still observes a
  correct, single tenant.
- **Platform support/admin tooling** — cross-tenant reads; every such call is
  audited (with `organization_id = NULL` plus the target in `metadata`).

Platform-admin ("AURIC staff") is **not** modelled as a tenant role. It is a
property of the code path + the `auric_system` role, never a `*:*` grant inside
someone's tenant.

## `ITenantContext` contract

New interface in `core/contracts/index.ts` — a *separate* contract, exactly as
`Plan.md` §7.3 says ("introduce a separate `ITenantContext` then — do not bake
tenancy into [`IOrganizationProvider`]"):

```ts
export interface ITenantContext {
  /** The active tenant. Throws if called outside a tenant-scoped request. */
  organizationId(): string;
  userId(): string;
}
```

Most domain modules never touch it — RLS plus an `organization_id` column default
handle them. It exists for the cases that must name the tenant explicitly
(cross-tenant reports run per tenant, tenant-aware cache keys, etc.). Update the
"single-tenant by default" comments in `core/contracts/index.ts` when this lands.

## Onboarding, invitations, lifecycle

- **Register** (`POST /api/auth/register`) creates only the global `users` row.
  No tenant.
- **Create organization** (`POST /api/organizations`) runs in system context to
  insert `organizations` + the creator's `organization_members` row with
  `membership_role = 'owner'`, then assigns the system `admin` role to that user
  scoped to the new org. First member is always `owner`.
- **Invitations** — a dedicated `organization_invitations` table
  (`id` (`inv_…`), `organization_id`, `email`, `membership_role`, `invited_by`,
  `token_hash`, `expires_at`, `accepted_at`). Accepting: if a `users` row exists
  for the email, add a membership; otherwise register then add. Email goes
  through the outbox. (Do **not** overload `verification_tokens`.)
- **Suspend / export / delete a tenant** — deferred until a real requirement.
  When built: suspend = flag on `organizations` checked in `authenticate`;
  delete = system-context cascade + a retained audit record.

## Migrations & rollout order

1. Create `auric_owner` / `auric_app` / `auric_system` roles and grants. Wire
   `AURIC_APP_DATABASE_URL` into `pool.ts`; keep `AURIC_DATABASE_URL` for
   `migrate.ts` and the test harness.
2. **Prisma migration** — add `organization_id` (nullable first) to `user_roles`,
   `audit_logs`, `notifications`, `files`, `outbox_messages`,
   `dead_letter_messages`; add `organization_invitations`; add the new
   `user_roles` PK.
3. **Backfill migration** — set `organization_id` on all existing rows to the
   seed org; then `SET NOT NULL` where required.
4. **Hand-written migration** — `ENABLE` + `FORCE` RLS and the policies on every
   scoped table, plus the two registry-table policies.
5. Extend `RequestContext`; add the `set_config` call to `unitOfWork.transaction`
   and the `readInTenant` helper.
6. Add `org` to `AccessTokenClaims`; add the target-org path to `refresh`; add
   the session/orgs endpoint.
7. `authenticate` hook: verify `org` claim against membership, `patchContext`.
8. Add `ITenantContext` + its provider; register in the composition root.
9. Move signup / create-org / outbox worker onto system context +
   `auric_system`.
10. Update `architecture.md`, `conventions.md`, `core/contracts/index.ts`
    comments, and `Plan.md` §7.3.

## Testing (`conventions.md` → `core/tests/`)

- **Cross-tenant leakage** — seed two orgs with data in each. As a member of org
  A: a deliberately unscoped `select` from `notifications` / `files` /
  `audit_logs` returns **only** org A's rows. Assert count and ids.
- **Write containment** — attempt an insert/update with `organization_id` set to
  org B while in org A's context → rejected by `WITH CHECK`.
- **Missing context** — a tenant-scoped query with no `organization_id` in
  context throws (not "returns everything", not "returns nothing silently").
- **Tenant switch** — refresh with org B after logging into org A yields an
  access token whose `perms` reflect org B's `user_roles`, not org A's.
- **Outbox** — a message tagged org A dispatches with org A's tenant set; a
  handler that reads a scoped table sees only org A.
- **System context** — signup and create-org succeed with no tenant set; the
  worker processes messages across both orgs.
- The integration harness resets the schema as `auric_owner` but runs the Core
  as `auric_app`, so `FORCE ROW LEVEL SECURITY` is exercised by the test suite.

## Deliberately deferred (Plan §0, §8)

Per-tenant custom roles and role UIs · tenant-level settings/theming/branding ·
plan & quota enforcement · tenant suspend/export/delete flows · DB-per-tenant
premium tier · per-tenant rate limiting. Each waits for a real requirement — the
foundation above (schema + RLS + context) is the part that is expensive to
retrofit; the rest is not.
