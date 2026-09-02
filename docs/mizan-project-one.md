# Mizan — Project #1

> **Canonical architecture note (2026-09).** Where this and an "as-built" doc
> disagree, this is the intended logical architecture. It sits alongside
> `Plan.md`, `docs/system-architecture.md`, `mizan/backend/app/README.md`,
> `mizan/web/README.md`, and every `core/*/README.md`.

---

## 1. What Mizan is

**Mizan** (codename *Project 404*) is a law-firm management system for
Tawfik & Partners. It is **Project #1** in AURIC's build → use → extract loop
(`Plan.md` §8, §10.1): the first real application built on AURIC Core.

Mizan is **one product with three parts**, all under the top-level `mizan/`
folder:

| Part | Physical location | Status |
|---|---|---|
| Backend / domain | `mizan/backend/app/lawfirm/` | in progress (Part-1 phases) |
| Web client | `mizan/web/` | F0–F16 built, MSW-backed |
| Mobile client | `mizan/mobile/` | Phase 2 (placeholder) |

Conceptually and now physically these three **are Mizan**. AURIC Core is **not**
Mizan — Core is the domain-agnostic foundation Mizan is built on, and it stays at
the repository root, outside `mizan/`.

```
                         AURIC
             ┌─────────────┴─────────────┐
       AURIC Foundation             AURIC Tooling
          core/                     CI · testing · observability
             ▼
        Mizan  (Project #1)  →  mizan/
   ┌──────────────┼──────────────┐
backend/app/lawfirm/  web/    mobile/
     backend        frontend   Phase 2
```

---

## 2. Physical layout

The repository gives Project #1 an **explicit top-level boundary**: `core/` (the
AURIC Foundation) stays at the root; everything Mizan-specific lives under
`mizan/`.

```
Physical                       Logical (what it represents)
──────────────────             ────────────────────────────
auric/
├── core/              ───────▶ AURIC Foundation  (reusable, versioned, generic)
├── mizan/             ─┐
│   ├── backend/        │
│   │   └── app/        │       Mizan  (Project #1 — one product, three parts)
│   │       └── lawfirm/├──────▶ · backend/app/lawfirm/ = Mizan backend / domain
│   ├── web/            │        · web/                 = Mizan web client
│   └── mobile/        ─┘        · mobile/              = Mizan mobile client (Phase 2)
├── prisma/            ───────▶ schema + migrations (Core + lawfirm tables)
├── scripts/  http/  docs/  storage/
└── main.ts  package.json  tsconfig.json  vitest.config.ts
```

Notes on what did **not** move:

- **`main.ts` stays at the repo root.** It is the single-process entrypoint that
  composes Core + the Mizan backend and boots the whole modular monolith; the
  backend package (`@auric/core` in the root `package.json`) is still rooted
  where `core/` is. `mizan/backend/app/` is the Mizan-specific slice of that
  package, cleanly separated from `core/`.
- **`prisma/`, `scripts/`, `http/`, `storage/`, and all root config
  (`package.json`, `tsconfig.json`, `vitest.config.ts`, `.swcrc`,
  `prisma.config.ts`) stay at the root** — they serve Core and Mizan together.
- **`mizan/web/`** is a standalone package (`name: "mizan-web"`, its own
  `tsconfig` / Vite config); nothing at the repo root references it, so the move
  needed no changes inside it.

The move updated: `main.ts` (`./app/…` → `./mizan/backend/app/…`),
`mizan/backend/app/{app.module,seed}.ts` (`../core/…` → `../../../core/…`), and
the `include` globs in the root `tsconfig.json` and `vitest.config.ts`. No
application behaviour or architecture changed — this was a physical relocation.

Still **not** created: `modules/`, `client-002/`, `client-003/`, `packages/` — see
§4 and §5.

---

## 3. The Core ↔ Mizan boundary (authoritative)

```
core/   ──X──▶  mizan/backend/app/lawfirm/   Core MUST NOT import client-domain code.
core/   ──X──▶  mizan/web/                   (verified: grep for "mizan/" in core/*.ts is empty)

mizan/backend/app/lawfirm/  ─────▶  core/    Only via core/contracts interfaces + DI tokens.
mizan/web/                  ─────▶  (HTTP)   Only via the Mizan/AURIC API. Imports no repo code.
```

### What each side owns

| | AURIC Core (`core/`) | Mizan (`mizan/backend/app/lawfirm/`, `mizan/web/`) |
|---|---|---|
| Concepts | User, Organization, Role, Permission, File, AuditEntry, Notification, OutboxMessage | Client, Contact, Matter, Hearing, Task, Document(metadata), Invoice, Payment, Expense, StaffProfile |
| Permissions | *platform* keys (`read:organization`, `manage:role`, …) + `admin` wildcard role | *law-firm* keys (`create:matter`, `void:invoice`, …) + roles `firm_admin … read_only` |
| Seed | `SeedService` — platform perms, `admin`, Core templates | `AppSeedService` — runs Core seed first, then adds lawfirm perms + roles |
| UI | design-system primitives are *infrastructure* the product is built from | opinionated law-firm screens — no `GenericERPClientPage` |

**Core must remain unaware of client-domain concepts** — it must not know what a
Matter, Hearing, Lawyer, Client, or Invoice is.

### How Mizan reaches Core

Domain code injects **by token, typed as the interface** (`core/contracts`):
`IUserProvider`, `IOrganizationProvider`, `ITenantContext`,
`IPermissionProvider`, `INotificationProvider`, `IFileStorage`, `IAuditLogger`,
`IEventBus` — never a Core table or concrete class. Full detail:
`core/README.md`, `mizan/backend/app/README.md`, `docs/integration-guide.md`.

**One sanctioned exception:** `mizan/backend/app/seed.ts` imports `RbacRepository` +
`parsePermissionKey` from `core/rbac` to seed the lawfirm perms/roles at boot.
Seeding is inherently a Core-internals operation and belongs to the composition
root; `RbacRepository` is a public `RbacModule` export. No *domain module*
reaches past `core/contracts`.

### How the web client reaches the system

`mizan/web/` imports **nothing** from `core/` or `mizan/backend/` — it consumes
the HTTP API only. It *re-implements* the permission matcher
(`mizan/web/src/lib/permissions/can.ts` mirrors `core/rbac`'s `permissionMatches`)
and the `ar-EG` formatters rather than importing them. Frontend `can()` is UX;
the backend is the security boundary. Full detail: `mizan/web/README.md`.

---

## 4. Future clients — not now

Per `Plan.md` §10.3 / §11.2 and `docs/system-architecture.md` §40–43:

- Each future client (`client-002`, …) is its **own repository**, consuming
  **AURIC Core as a versioned, pinned package** (`@auric/core@x.y.z`).
- This repository is **not** becoming a monorepo of future clients. There are no
  `client-002/` / `client-003/` folders and none will be created here.
- The next client, when it exists, **forks the nearest prior build** (Mizan) and
  adapts it. It does not start from an abstracted framework.

---

## 5. Reusable-module extraction — the Rule of Three

There is **no `modules/` directory** and none will be created until the Rule of
Three is met (`Plan.md` §8, §10.2; `system-architecture.md` §40, §47 rules 4, 5,
20):

> A capability becomes an AURIC reusable module only after it has been
> implemented across **three** real, different client projects **and** its
> stable reusable shape is visible.

- A `mizan/backend/app/lawfirm/<area>/` folder being a clean, fully-anatomised
  module does **not** make it reusable. It is Client #1's domain, built properly.
- Eventual *candidates* (candidates, not promises): Documents, Tasks,
  CRM/Clients, Billing, Approvals.
- **Stays client-specific** regardless: Matters, Hearings, court/lawyer
  workflows, legal terminology and rules.
- No speculative abstraction "to prepare for future clients" (§47 rules 17–19).

---

## 6. Documentation map

| Doc | Scope |
|---|---|
| `README.md` (root) | clone & run; per-module contract index |
| `Plan.md` | the AURIC constitution / governing rules |
| `docs/system-architecture.md` | the canonical destination vision |
| `docs/architecture.md` | Core v0.1 as-built |
| `docs/tenancy.md` | multi-tenancy design |
| `docs/integration-guide.md` | building a client project on Core |
| **`docs/mizan-project-one.md`** | **this file — Mizan = Project #1, the Core ↔ Mizan boundary** |
| `core/README.md` + `core/*/README.md` | per-capability architectural contracts |
| `mizan/backend/app/README.md` | Mizan backend contract + boundary |
| `mizan/web/README.md` · `mizan/web/ARCHITECTURE.md` · `mizan/web/PLAN.md` | Mizan web |
