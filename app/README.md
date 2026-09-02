# `app/` — the client application

This directory is the **actual product** built on the AURIC Foundation:
**Mizan** (codename *Project 404*), a law-firm ERP for Tawfik & Partners. It is
Project #1 in AURIC's build-use-extract loop (`Plan.md` §8, §10.1).

The running deployable is **Mizan**, *powered by* AURIC Core — it is not "Core".

```
                 REPOSITORY
                     │
         ┌───────────┴────────────┐
         │                        │
   AURIC FOUNDATION         CLIENT APPLICATION
      core/                    app/
   platform, reused,       Mizan — Project #1
   versioned, generic      law-firm domain
```

## Boundary (hard rule)

- `core/` is the **AURIC Foundation** — cross-cutting platform infrastructure.
- `app/` is **client / product-specific** code.

```
core/  ──X──▶  app/        Core MUST NOT import from app/.
app/   ─────▶  core/       Only through Core's public contracts / DI tokens.
```

**Core must remain unaware of client-domain concepts.** For example:

- Core must not know what a Matter, Hearing, Lawyer, Client, or Invoice is.
- Core must not contain law-firm permissions or roles.
- A domain module reaches Core only via `IUserProvider`, `IOrganizationProvider`,
  `ITenantContext`, `IPermissionProvider`, `INotificationProvider`,
  `IFileStorage`, `IAuditLogger`, `IEventBus` — never a Core table or concrete class.

`core/app.module.ts` is retained only as the fixture for Core's own integration
tests. The running composition root is `app/app.module.ts`.

## Two seed layers (not one)

`AppSeedService` runs them in order on every boot, idempotently:

| Layer | Owner | Seeds |
|---|---|---|
| Core seed (`SeedService`) | AURIC Foundation | platform permissions (`read:organization`, `manage:role`, …) + the `admin` wildcard role + bilingual notification templates |
| Mizan seed (`AppSeedService`) | this app | law-firm permissions (`create:matter`, `record:payment`, …) + starting roles (`firm_admin`, `partner`, `lawyer`, `paralegal`, `finance`, `read_only`) |

So the platform has *N* permissions and Mizan adds *M* — never "AURIC has N+M".
Roles are seeded into Core RBAC but stay editable via `/api/rbac`; **no domain
code branches on a role key — only on permissions.**

## Structure

```
app/
├── app.module.ts        composition root: Core feature modules + LawfirmModule
├── seed.ts              AppSeedService (Core seed → Mizan seed)
├── version.ts           APP_NAME / APP_VERSION — distinct from Core's version
└── lawfirm/             the Mizan domain (Plan §10.1 app/<client-domain>/)
    ├── lawfirm.module.ts
    ├── permissions.ts   aggregates every area's permissions.ts
    ├── shared/          ids · rbac types · role definitions
    └── <area>/          clients · matters · hearings · tasks · documents ·
                         billing · staff · settings · dashboard
                         → each grows into: domain/ application/ infrastructure/
                           api/ events/ permissions/ validation/ tests/
```

## Extraction — not yet

A `lawfirm/<area>/` folder being a well-isolated module with full anatomy does
**not** make it a reusable AURIC module. It is Client #1's domain, built properly.

Do **not** extract anything into `modules/` or into Core prematurely. A capability
becomes an extraction candidate only after it has been implemented across
**three** real, different client projects and its stable reusable shape is
visible (`Plan.md` §8, §10.2 — the rule of three). Until then, the next client
forks the nearest prior build.
