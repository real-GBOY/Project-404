# AURIC Core — Integration Guide

How to build on Core in a client project (Plan §13), and how to add a module.

## Using Core in a client project

Core is consumed as a versioned internal package, pinned per project
(Plan §10.3, §11.2). A client repo:

```ts
import { createAuricCore } from "@auric/core";

const core = createAuricCore({
  config: { appName: "Client X", defaultLocale: "ar" },
  // emailChannel: myClientSmtpChannel,   // optional overrides
});

await core.start();            // migrate + seed + start outbox worker
core.app.listen(3000);         // Express app — mount client routes on it too

// client code calls use cases directly, or depends on the provider interfaces:
core.modules.identity.userProvider;      // IUserProvider
core.modules.rbac.permissionProvider;    // IPermissionProvider
core.modules.notifications.provider;     // INotificationProvider
core.modules.files.storage;              // IFileStorage
core.events;                             // IEventBus
```

Client-specific domain code lives in the client repo (Plan §10.1 `app/`), not
in Core. It depends on the contracts, never on Core's tables.

## The provider interfaces (Plan §4)

A client/domain module never does `SELECT … FROM users`. It takes the
interface it needs and calls it:

| Interface | Get a user, check existence |
|---|---|
| `IUserProvider` | `getUser(id)`, `userExists(id)` |
| `IOrganizationProvider` | `getOrganization(id)`, `isMember(orgId, userId)` |
| `IPermissionProvider` | `can(userId, action, resource)`, `assignRole`, `permissionsFor` |
| `INotificationProvider` | `send({ userId, templateKey?, channels })` |
| `IFileStorage` | `upload`, `getUrl`, `getContent`, `delete` |
| `IAuditLogger` | `record({ actorId, action, resourceType, before, after })` |
| `IEventBus` | `publish(event)` |

## Adding a domain module (e.g. an `app/employee`)

Follow the module anatomy (Plan §3.2):

```
employee/
├── domain/          Employee entity + rules (no SQL, no HTTP)
├── application/     use cases — each owns its transaction
├── infrastructure/  repositories via `currentExecutor()`; provider impls
├── api/             Express router; controllers stay thin
├── events/          events it publishes (employee.created, …) + subscribers
├── permissions/     PermissionDefinition[] it contributes to RBAC
├── validation/      Zod schemas
├── migrations/      NNN_*.ts, added to core/kernel/db/migrations-manifest.ts
└── tests/
```

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
6. **One migration order.** Append your migration to
   `core/kernel/db/migrations-manifest.ts` after any table you FK to.

## Integrations & compliance are NOT localization (Plan §7.11, §12B)

ETA e-invoicing, local payment gateways, SMS providers — these are **adapters**
added when a real project needs them, living behind an interface in an
`infrastructure/` or an adapters layer, invoked as external-effect events
through the outbox. They do not go in `core/localization`, which is only
language, direction, and formatting.

## Upgrading Core in a client (Plan §11.3)

Pinned. Core changes never auto-flow. Bumping the pinned version is scheduled,
tested maintenance work; security patches get priority windows.
