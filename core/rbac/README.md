# `core/rbac` — roles, permissions, authorization

## 1. What it is

Role-based access control (Plan §7.2): `User → Role → Permission`, with the
authoritative check `can(userId, action, resource)` supporting `*` wildcards in
either segment. Exposes `IPermissionProvider` — the single answer to *"is this
user allowed to do this, in this tenant?"*

## 2. Why it exists

Authorization is a security boundary and must be one implementation, evaluated on
the server, on every sensitive operation. Scattering `if (role === "admin")`
checks through the code is how authorization bugs happen.

## 3. What problem it solves

- A uniform permission key format (`action:resource`, e.g. `create:matter`) that
  the backend, the JWT `perms` claim, and the frontend `can()` all agree on.
- Roles as editable *bundles of permissions*, not hard-coded behaviour.
- Tenant-scoped evaluation: the same user can be `firm_admin` in one org and
  `read_only` in another.

## 4. Responsibilities

- `RbacPermissionProvider.can()` / `.permissionsFor()` / `.assignRole()`
  (`IPermissionProvider`).
- `RbacService` use cases: create role, grant/revoke a permission on a role,
  assign/unassign a role to a user — each audited.
- `permissionMatches(held, action, resource)` — the wildcard-aware matcher
  (mirrored verbatim in `web/src/lib/permissions/can.ts`).
- React to identity events (e.g. a newly registered/first user) via subscribers
  registered in `OnModuleInit`.

## 5. What it owns

Tables: `permissions`, `roles`, `role_permissions`, `user_role_assignments`
(`prisma/schema/rbac.prisma`). The permission-key grammar. The wildcard
semantics.

## 6. What it explicitly does NOT own

- **Which** permissions exist for a product. Core's seed adds only *platform*
  permissions; Mizan's `AppSeedService` adds `create:matter`, `void:invoice`, …
  (see `core/bootstrap/README.md`, `app/README.md`).
- **User accounts** (`core/identity`) — RBAC keys assignments by `userId` but
  does not own the user.
- **Enforcement placement** — modules and `core/http`'s `PermissionGuard`
  *call* `can()`; RBAC does not know the routes.
- Attribute-/relationship-based access (per-record ACLs). Mizan v1 uses
  firm-wide read + permission-gated writes; per-matter ACLs are explicitly out.

## 7. Public surface

- `RbacModule` — exports token `PERMISSION_PROVIDER` (`IPermissionProvider`),
  plus `RbacService` and `RbacRepository` (the latter for the composition
  root's seed only).
- HTTP (`/api/rbac`): `GET roles`, `POST roles`,
  `POST roles/:roleKey/permissions`, `DELETE roles/:roleKey/permissions/:key`,
  `POST assignments`, `DELETE assignments/:userId/:roleKey`,
  `GET users/:userId`.

## 8. How to use

In a use case, gate a write:

```ts
if (!(await this.perms.can(actorId, "close", "matter"))) {
  throw Forbidden("matter.forbidden", "You can't close matters.");
}
```

Or declaratively on a controller (`core/http`):

```ts
@Post()
@RequirePermission("create:matter")
create(@Body(ZodBody(schema)) input: CreateMatter) { … }
```

## 9. Dependencies & direction

Imports `AuditModule`, `EventsModule`. Consumed by `core/identity` (token
claims), `core/http` (the guard), `core/files`, and every domain module.

## 10. Invariants

1. `can()` is evaluated **server-side**, within the **active tenant**.
2. Key format is `action:resource`. Both segments accept `*`.
3. Domain code checks **permissions**, never role names. Roles are just bundles.
4. Every role/permission/assignment mutation is written through `RbacService` and
   audited — never a raw `INSERT`.
5. The `permissionMatches` algorithm is duplicated in the web client on purpose;
   the two must stay identical.

## 11. Example — wildcard match

```
held "read:*"        · can("read", "matter")   → true
held "*:invoice"     · can("void", "invoice")   → true
held "create:matter" · can("create", "hearing") → false
held "*:*"  (admin)  · anything                 → true
```

## 12. Testing expectations

`core/rbac/tests/` + `core/tests/`: wildcard matrix; a permission granted to a
role takes effect for its members immediately; revoking it blocks the next
request; assignments are tenant-scoped; every mutation produced an audit entry;
the guard returns 403 (not 401) for an authenticated-but-unauthorized user.

## 13. When NOT to extend it

- To add per-record / relationship ACLs speculatively — only if a real project's
  rules cannot be expressed as firm-wide permissions.
- To encode product-specific permissions in Core — they are seeded by the app.
- To let any code path branch on a role key.
