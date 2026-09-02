# `core/bootstrap` — the Core seed

## 1. What it is

`SeedService` — the idempotent, boot-time seeding of everything the **platform**
needs to function: the platform permission set, the wildcard `admin` role, and
Core's bilingual notification templates.

## 2. Why it exists

A fresh database must be usable. Some rows are infrastructure, not data — the
`admin` role, the `read:organization` permission, the "verify your email"
template. They are re-asserted on every boot so environments never drift.

## 3. What problem it solves

- No manual SQL to stand up a new environment for Core's own capabilities.
- A clean split between *platform* seed and *product* seed (see §6).
- Idempotency: running it twice changes nothing.

## 4. Responsibilities

- Seed platform permissions (`read:organization`, `manage:role`,
  `read:audit_log`, …) into `core/rbac`.
- Seed the `admin` role bound to `*:*`.
- Seed Core notification templates (verification, password reset, welcome) in AR
  and EN.
- Be safe to call repeatedly (upsert semantics).

## 5. What it owns

The list of *platform* permissions and the *platform* templates. The `admin`
role definition.

## 6. What it explicitly does NOT own

- **Product permissions and roles.** Mizan's `AppSeedService`
  (`app/seed.ts`) runs the Core seed **first**, then adds `create:matter`,
  `record:payment`, `void:invoice`, … and the roles `firm_admin`, `partner`,
  `lawyer`, `paralegal`, `finance`, `read_only`.
  > So the platform has *N* permissions and Mizan adds *M* — never "AURIC has
  > N+M". Roles are seeded into Core RBAC but stay editable via `/api/rbac`.
- Demo/sample business data (clients, matters). That is a separate app-level
  demo seeder (Mizan decision #14), and production paths stay empty.
- Any user account (there is no bootstrap-admin endpoint — an admin is granted
  directly in the DB for a new environment).

## 7. Public surface

- `SeedService` — exported from `core/index.ts`. The composition root calls
  `seedService.run()` after migrations, before `listen()`.

## 8. How to use

```ts
// app/seed.ts — the product's seed orchestrator
@Injectable()
export class AppSeedService {
  constructor(private readonly coreSeed: SeedService, private readonly rbac: RbacRepository) {}
  async run() {
    await this.coreSeed.run();          // 1. platform permissions + admin + Core templates
    await this.seedLawfirmPermissions();  // 2. create:matter, void:invoice, …
    await this.seedLawfirmRoles();        // 3. firm_admin, partner, …
  }
}
```

`app/seed.ts` is the **one sanctioned place** `app/` reaches past `core/contracts`
into `core/rbac` internals (`RbacRepository`, `parsePermissionKey`) — seeding is
inherently a Core-internals operation and belongs to the composition root.

## 9. Dependencies & direction

Depends on `core/rbac` and `core/notifications`. Called by the composition root
(`app/app.module.ts` bootstrap). Nothing depends on it.

## 10. Invariants

1. Idempotent — every run converges to the same state.
2. Runs **after** migrations, **before** the server listens.
3. Core seed runs before any product seed.
4. Seeds infrastructure rows only — never business data, never user accounts.
5. Product permissions/roles are added by the product's seeder, layered on top.

## 11. Example — the two layers on one boot

```
migrate  →  SeedService.run()  →  AppSeedService adds lawfirm perms/roles  →  listen(:3000)
            └ platform perms       └ create:matter, firm_admin, …
            └ admin (*:*)
            └ Core templates (AR/EN)
```

## 12. Testing expectations

`core/tests/`: after `run()`, the platform permissions and `admin` role exist;
a second `run()` is a no-op; Core templates render in AR and EN. Mizan's own
integration tests assert the layered result (platform + lawfirm).

## 13. When NOT to extend it

- To seed product permissions/roles — do that in the product's seeder.
- To seed demo/sample data — that is a separate opt-in seeder.
- To create a default admin user — grant it in the DB for a new environment.
