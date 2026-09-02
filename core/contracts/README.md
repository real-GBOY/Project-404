# `core/contracts` — the provider interfaces

## 1. What it is

A single dependency-free TypeScript file (`index.ts`) of interfaces and value
types that Core capabilities expose and that client/domain code depends on:
`IUserProvider`, `IOrganizationProvider`, `ITenantContext`,
`IPermissionProvider`, `INotificationProvider`, `IFileStorage`, `IAuditLogger`,
`IEventBus`, plus `User`, `Organization`, `FileRef`, `AuditEntry`,
`NotificationPayload`, `DomainEvent`, and `defineEvent`.

## 2. Why it exists

To decouple *what a module needs* from *which module provides it*. A matters
module needs "get a user"; it should not know that `IdentityModule` exists, own a
`SELECT … FROM users`, or import `IdentityService`.

## 3. What problem it solves

- **Forkability**: a domain module written against `IUserProvider` moves to the
  next client project unchanged.
- **Loose coupling**: Core internals can be rewritten as long as the contract
  holds.
- **Testability**: a use case takes the interface; a test passes a fake.

## 4. Responsibilities

- Define the smallest useful interface for each cross-module dependency.
- Define the shared value types those interfaces pass around.
- Carry the tenancy rule in prose: the active tenant is **ambient**, not a
  parameter — `ITenantContext` is the one place it is named.

## 5. What it owns

The interface definitions and their value types. Nothing else — no
implementation, no state, no imports beyond `./domain-event`.

## 6. What it explicitly does NOT own

- Implementations (those live in each module's `infrastructure/`).
- The DI tokens that bind interface → implementation (those are in
  `core/kernel/tokens.ts`).
- Any domain/business type. `Matter`, `Invoice`, etc. never appear here.
- Persistence shapes / database row types.

## 7. Public surface

Everything in `index.ts` is public and re-exported from `core/index.ts` as
`export type * from "./contracts"`. Key interfaces:

| Interface | Methods |
|---|---|
| `IUserProvider` | `getUser(id)`, `userExists(id)` |
| `IOrganizationProvider` | `getOrganization(id)`, `isMember(orgId, userId)`, `membershipsForUser(userId)` |
| `ITenantContext` | `organizationId()` (throws 401 if none), `organizationIdOrNull()` |
| `IPermissionProvider` | `can(userId, action, resource)`, `assignRole(userId, roleId)`, `permissionsFor(userId)` |
| `INotificationProvider` | `send(payload)` |
| `IFileStorage` | `upload(input)`, `getUrl(ref)`, `getContent(ref)`, `delete(ref)` |
| `IAuditLogger` | `record(entry)` |
| `IEventBus` | `publish(event)` — publish-only, runs inside the caller's transaction |

## 8. How to use

Inject the token from `core/kernel/tokens.ts`, type it as the interface:

```ts
import { Inject } from "@nestjs/common";
import { USER_PROVIDER } from "@auric/core";
import type { IUserProvider } from "@auric/core";

constructor(@Inject(USER_PROVIDER) private readonly users: IUserProvider) {}
```

## 9. Dependencies & direction

Depends on nothing (except its own `domain-event`). **Everything depends on it**
and nothing it depends on depends back. It is the leaf of the Core graph.

## 10. Invariants

1. No runtime code, no side effects, no framework imports.
2. Interfaces are consumer-shaped and minimal — add a method only when a real
   consumer needs it.
3. A breaking change here ripples to every module and every client project —
   treat it like a public API change (additive where possible; version bump if
   not).
4. The tenant stays ambient. Do not add `organizationId` parameters to these
   interfaces.

## 11. Example — adding a capability

```ts
// A new "search" capability Core will provide:
export interface ISearchIndex {
  index(doc: { id: string; type: string; text: string }): Promise<void>;
  query(text: string, opts?: { type?: string }): Promise<Array<{ id: string; type: string }>>;
}
```

Then a token in `kernel/tokens.ts`, and a `SearchModule` binding it — but only
once a real feature requires search (Plan §7.9: Postgres FTS first, no
Elasticsearch until scale forces it).

## 12. Testing expectations

Contracts have no tests of their own. They are exercised by:
- each module's integration tests (its implementation satisfies the interface),
- each consumer's use-case tests (against a fake implementation).

## 13. When NOT to change it

- To leak a module-internal type outward — keep the interface narrow.
- To add a business concept — that belongs to a domain module's own types.
- To pass the tenant explicitly — RLS + `ITenantContext` already handle it.
