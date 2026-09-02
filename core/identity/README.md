# `core/identity` — identity & authentication

## 1. What it is

User accounts and authentication (Plan §7.1): register, login, logout,
logout-all, refresh-token rotation, email verification, password reset, Argon2id
hashing, JWT access tokens. Exposes `IUserProvider` (how the rest of the system
reads user data) and a JWT service (how the HTTP guard authenticates requests).

## 2. Why it exists

Every application authenticates users. This is the one correct implementation:
timing-safe credential checks, rotating refresh tokens with reuse detection,
verification/reset flows that never reveal whether an email exists.

## 3. What problem it solves

- Secure auth without every project re-deriving the token-rotation and
  hashing details.
- A stable seam (`IUserProvider`) so domain code can show "assigned to Nour
  El-Sayed" without touching the `users` table.
- Login that resolves the active tenant from the user's memberships.

## 4. Responsibilities

- `IdentityService` use cases: `register`, `login`, `refresh`, `logout`,
  `logoutAll`, `requestPasswordReset`, `resetPassword`, `verifyEmail`,
  `requestEmailVerification`.
- Password hashing (`argon2id`) + transparent rehash on login when params change.
- Refresh-token family tracking; reuse of a rotated token revokes the whole
  family.
- Issue access tokens with `{ sub, email, org, perms }` — perms resolved *in the
  active tenant* via `IPermissionProvider`.
- Publish identity events (`user.registered`, `email_verification.requested`,
  `password_reset.requested`, `user.email_verified`, `user.password_reset`).
- `IdentityUserProvider` implements `IUserProvider`.

## 5. What it owns

Tables: `users`, `refresh_tokens`, `verification_tokens`
(`prisma/schema/identity.prisma`). The `User` public shape. The access/refresh
token format and TTLs.

## 6. What it explicitly does NOT own

- **Permissions / roles** — `IdentityService` *asks* `IPermissionProvider` for
  perms to embed in the token; it never stores or decides them (`core/rbac`).
- **Organizations / membership** — it *reads* memberships at login via
  `IOrganizationProvider` to resolve the active tenant; it does not manage them
  (`core/organizations`).
- **Sending** the verification / reset emails — it publishes an event;
  `core/notifications` delivers.
- Sessions beyond token issuance/rotation (no server-side session store).
- Social / SSO / 2FA — not in v0.1; added only when a project needs it.

## 7. Public surface

- `IdentityModule` — exports token `USER_PROVIDER` (`IUserProvider`) and
  `JWT_SERVICE`.
- `REQUIRE_EMAIL_VERIFICATION` token — set `false` for admin-provisioned users /
  tests.
- HTTP (`/api`): `POST auth/register|login|refresh|logout|logout-all`,
  `POST auth/password/forgot|reset`, `POST auth/email/verify|resend`,
  `GET me` → `{ user, organizationId, permissions }`.

`login` response: `{ user, tokens: { accessToken, refreshToken, expiresIn,
tokenType }, organizations: OrganizationMembership[] }`. One membership → token is
tenant-scoped; zero or many → `org: null`, client picks (see `docs/tenancy.md`
and `mizan/web/`'s org selector).

## 8. How to use

Domain code, to read a user:

```ts
constructor(@Inject(USER_PROVIDER) private readonly users: IUserProvider) {}
const actor = await this.users.getUser(principal.userId);
```

Protect a route: `@UseGuards(JwtAuthGuard)` (from `core/http`, backed by
`JWT_SERVICE`) + `@CurrentUser()` for the `Principal`.

## 9. Dependencies & direction

Imports `AuditModule`, `EventsModule`, `RbacModule`, and
`forwardRef(OrganizationsModule)` (the deliberate identity ↔ organizations
cycle). Consumed by every module that needs user data and by `core/http`'s
guard. Nothing in Core depends on Identity's internals.

## 10. Invariants

1. Login and reset requests are **timing-safe** and never disclose account
   existence.
2. Refresh tokens rotate on every use; reusing a rotated token revokes the whole
   family.
3. The access token's `perms` claim is resolved for the **active tenant** only.
4. Password hashing is `argon2id`; parameters may only increase.
5. Email delivery is out-of-band via an event + the outbox — `login`/`register`
   never block on SMTP.

## 11. Example — login → tenant resolution

```
POST /api/auth/login { email, password }
  └─ verify credentials (argon2id, timing-safe)
  └─ memberships = IOrganizationProvider.membershipsForUser(user.id)
  └─ activeOrg = memberships.length === 1 ? memberships[0] : null
  └─ perms = activeOrg ? IPermissionProvider.permissionsFor(user.id) : []
  └─ accessToken = sign({ sub, email, org: activeOrg, perms })
  └─ 200 { user, tokens, organizations: memberships }
```

## 12. Testing expectations

`core/identity/tests/` + `core/tests/`: wrong password and unknown email take the
same time; refresh rotation + reuse-revocation; reset consumes the token once and
revokes sessions; verification is idempotent; a disabled/pending user cannot log
in; the token's `perms` match the active tenant only.

## 13. When NOT to extend it

- To add role/permission logic — that is `core/rbac`.
- To add org-membership management — that is `core/organizations`.
- To add SSO/2FA/magic-links before a real project requires them.
- To branch any behaviour on a *role name* — always check a permission.
