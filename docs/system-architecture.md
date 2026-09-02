# AURIC — Full System Architecture

> **Status: canonical vision (2026-09-02).** This is the destination map for the
> whole system — AURIC Foundation + Mizan (Project #1) backend, web, and mobile,
> plus infrastructure. It sits above:
>
> - `Plan.md` — the AURIC constitution / governing rules
> - `docs/architecture.md` — what Core v0.1 *actually* is today
> - `docs/tenancy.md` — the multi-tenancy design
> - `app/README.md` — the Core ↔ Mizan boundary
> - `web/PLAN.md` / `web/ARCHITECTURE.md` — the Mizan web build
>
> Where this document and an "as-built" doc disagree, this is the *intended*
> direction and the as-built doc is *current reality*. Build incrementally
> toward this — do not build all of it at once (§48).

---

## 0. What AURIC Actually Is

AURIC is a software foundation for building and operating client-specific
business applications.

The first real application built on it is:

> **Mizan — Project #1 — Law Firm Management System**

AURIC is **NOT** itself a law-firm ERP.

```
                         AURIC
                           │
             ┌─────────────┴─────────────┐
             │                           │
       AURIC Foundation             AURIC Tooling
             │                    CI / testing /
             │                    observability / deployment
             ▼
        Client Application
             ▼
           Mizan  (Project #1)
             │
      ┌──────┴──────┐
     Web           Mobile
```

The first goal is **not** a generic ERP platform. It is: build one excellent real
application on a strong foundation. Only after multiple real applications exist
should repeated domain patterns be extracted into reusable AURIC modules.

---

## 1. High-Level Architecture

```
CLIENTS            Mizan Web            Mizan Mobile
                        └──────┬───────────┘
                               ▼
                        HTTP / API Layer
                               ▼
MIZAN BACKEND     Clients · Matters · Hearings · Tasks · Documents
                  Billing · Staff · Settings · Dashboard
                               ▼
AURIC CORE        Identity · RBAC · Organizations · Tenancy
                  Files · Audit · Notifications · Events
                  Localization · Observability · Contracts · HTTP
                               ▼
INFRASTRUCTURE    PostgreSQL · Redis · Object Storage · Email · Push
                  Monitoring · Logs · CI/CD
```

---

## 2. Repository Architecture

The first project stays **one coherent repository**.

```
auric/
├── core/            AURIC Foundation
├── app/lawfirm/     Mizan backend domain
├── web/             Mizan web client
├── mobile/          Mizan mobile client (Phase 2)
├── packages/        contracts/ ui/ config/ utils/   ← only when reuse is proven
├── prisma/          schema + migrations
├── docs/  tests/  scripts/
└── package.json  tsconfig.json  vitest.config.ts  README.md
```

**Do not create every package immediately.** If something is only used by Mizan
today, keep it close to Mizan until reuse is proven. Logical architecture matters
more than forcing every layer into a package on day one.

---

## 3–9. Backend

NestJS **modular monolith on Fastify**. Not microservices.

Two conceptual layers: **AURIC Core** + **Mizan Application** (`app/lawfirm/`).

- **Core** (`core/`): kernel · identity · rbac · organizations · tenancy · files ·
  audit · notifications · localization · observability · events · contracts · http.
  Provides infrastructure and capabilities. **Must not know** `Matter`, `Lawyer`,
  `Hearing`, `Invoice`, `Case`, `Client`.
- **Mizan** (`app/lawfirm/`): one bounded module per feature — clients, matters,
  hearings, tasks, documents, billing, staff, settings, dashboard. Each mature
  module: `domain/ application/ infrastructure/ api/ events/ permissions/
  validation/ tests/ feature.module.ts`.
- **Domain layer**: business concepts + rules. No NestJS/Fastify/Prisma/HTTP/
  Postgres/Redis/S3.
- **Application layer**: use cases. Each owns its transaction boundary:
  `authenticate context → validate rules → transaction → persist → publish event`.
- **Infrastructure layer**: repositories, DB, providers, integrations. Domain/
  application depend on interfaces/tokens, not implementations.
- **API layer**: thin controllers.
  `request → controller → authn → tenant context → authz → validation → use case → response`.
  No business logic in controllers.

---

## 10. Authorization

`User → Role → Permissions`. Mizan roles: `firm_admin`, `partner`, `lawyer`,
`paralegal`, `finance`, `read_only`. Permissions like `matter:read`,
`matter:create`, `matter:close`. Frontend permissions = UX. **Backend permissions
= the security boundary.**

> **As-built note:** the backend key format is `action:resource` (`create:matter`),
> Core's convention. Diagrams here use `matter:create` for readability — the
> canonical key is what `/api/me` returns.

---

## 11. Multi-Tenancy

Mizan is the SaaS build. `Organization` owns Users, Clients, Matters, Hearings,
Tasks, Documents, Billing. Every tenant-owned table has `organization_id NOT NULL`.
PostgreSQL **RLS** enforces isolation.

```
Request → Authentication → Organization Context → SET LOCAL tenant context
        → Transaction → PostgreSQL RLS
```

Application code should not manually append tenant filters everywhere.

---

## 12. Database

PostgreSQL. **Prisma** for schema organization, migrations, generated types.
**Kysely** for explicit application queries, repositories, complex queries.
DB constraints stay authoritative: `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`,
composite FK, RLS, triggers.

---

## 13–16. Cross-cutting (Core-owned, Mizan-consumed)

- **Events**: `MatterCreated`, `HearingScheduled`, `PaymentRecorded`, … Use events
  where they actually provide decoupling — not everywhere.
- **Notifications**: in-app · email · push. `HearingScheduled → handler → user notification`.
- **Files**: Mizan uses `IFileStorage` → adapter → object storage. Never S3/Cloudinary directly.
- **Audit**: sensitive ops emit audit events via `IAuditLogger`. Core owns the trail.

---

## 17. Backend Composition

```
main.ts → NestFactory → AppModule
                          ├── Core modules
                          └── LawfirmModule
                                ├── ClientsModule · MattersModule · HearingsModule
                                ├── TasksModule · DocumentsModule · BillingModule
                                └── StaffModule · SettingsModule · DashboardModule
```

`core/app.module.ts` is **not** the production composition root (it is the Core
test fixture). The running root is `app/app.module.ts`.

---

## 18–21. Web Frontend

`web/` — React + TypeScript + Vite.

```
web/src/
├── app/         router/ providers/ layouts/
├── features/    auth/ dashboard/ clients/ matters/ hearings/ tasks/
│                documents/ billing/ staff/ settings/
│                └── pages/ components/ hooks/ api/ schemas/ types/
├── components/  ui/ forms/ tables/ feedback/ navigation/
├── lib/         api/ auth/ permissions/ tenant/ i18n/ format/
├── hooks/       cross-feature hooks
├── types/       shared API contract types
└── styles/
```

- Domain-specific UI stays inside its feature. Shared visual primitives live in
  `components/ui/`.
- Design system primitives (Button, Input, Select, Dialog, Drawer, Table, Tabs,
  Badge, Card, Dropdown, Tooltip, Toast, Form, DatePicker, CommandMenu) are
  infrastructure — the Mizan product UI built from them stays opinionated, never
  generic. No `GenericERPClientPage`, `UniversalBusinessDashboard`.
- State: separate server state · UI state · auth state · form state · tenant
  context. No global-state library unless genuinely needed.

---

## 22–24. Mobile (Phase 2)

`mobile/` — React Native + TypeScript + Expo. Separate client of the **same
backend**, no backend of its own.

```
Mizan Mobile → Mizan/AURIC API → Mizan Backend → AURIC Core → Database
```

Mobile does **not** duplicate every web screen. Web = density, tables, admin,
billing, configuration. Mobile = quick actions, notifications, hearings, tasks,
matter/client lookup, document access, approvals, field use.

---

## 25–27. Shared code & API client

- Shared **API contracts** eventually live in `packages/contracts/` (DTOs, request/
  response types, permission identifiers, enums, pagination, error contracts). The
  frontend needs **API contracts, not database entities** — never duplicate
  backend domain models blindly.
- Web and mobile may need **different UI systems** — do not force DOM and RN
  components into one library. Shareable: types, constants, validation schemas,
  API contracts, business-independent utilities, permission identifiers. Not
  shareable: DOM/RN components, navigation, responsive layouts.
- Both clients consume a common API contract. The backend should expose
  **versioned APIs** (`/api/v1/...`).
  > **As-built note:** the backend currently mounts at `/api` (unversioned).
  > Versioning is a destination item — introduce `/api/v1` when a second client
  > or a breaking change makes it real.

---

## 28–35. Auth, notifications, search, caching, jobs, observability, security

- **Auth** belongs to Core: `User → Identity → Authentication → Session/Token →
  Organization Context → Permissions`. Web and mobile use platform-appropriate
  secure storage; don't expose tokens to JS storage unnecessarily.
- **Frontend authz**: receives effective permissions, uses `can("matter:create")`
  for UI decisions. Not `if role === "admin"` everywhere.
- **Notifications**: backend event → notification service → in-app / email / push.
  Web via SSE/WebSocket/polling *per real need*. Don't add WebSockets speculatively.
- **Search**: PostgreSQL search first. No Elasticsearch/OpenSearch until scale
  justifies it.
- **Caching**: Redis for caching / rate limiting / queues / temp state /
  coordination — not everything. DB is the source of truth.
- **Background jobs**: queue → worker → external service, for invoice email,
  document processing, notification delivery, reports, large exports. Don't turn
  normal CRUD into jobs.
- **Observability**: Core provides structured logging, correlation IDs, request
  IDs, metrics, health checks, error-tracking hooks. A correlation id threads
  request → logs → db → events → notifications.
- **Security at every layer**: client → API → authn → authz → tenant context →
  application rules → DB constraints → RLS. Never trust frontend restrictions,
  client-provided org IDs, or role checks without tenant isolation.

---

## 36–38. Infrastructure, deployment, testing

- **Infra** (conceptual): Internet → LB → NestJS/Fastify → {PostgreSQL, Redis,
  Object Storage} + email/push/monitoring/error-tracking/DNS/TLS/CI-CD. Don't
  hard-code vendor dependencies into Core.
- **Environments**: development · staging · production. CI:
  `push → lint → typecheck → unit → integration → build → migration validation → deploy`.
  Production migrations controlled and reversible where possible.
- **Testing**: backend — unit, use-case, integration, authorization, tenant
  isolation, API. Frontend — component, feature, integration, accessibility, E2E.
  Critical backend tests: tenant A ⊗ tenant B, unauthorized action blocked,
  permission changes take effect, RLS cannot be bypassed.

---

## 39. Data Ownership (critical rule)

```
core/         owns platform concepts: User, Organization, Role, Permission,
              File, AuditEntry, Notification
app/lawfirm/  owns law-firm concepts: Client, Matter, Hearing, Task, Invoice,
              Payment, Expense
```

Core must never become a dumping ground for application entities.

---

## 40–43. Extraction & reusability

- **No `modules/` on day one.** Process:
  `build Mizan → build another real client → and another → compare → identify
  stable repetition → extract → AURIC reusable module`. **Rule of Three.**
- Eventual module candidates (candidates, not promises): Documents, Tasks,
  CRM/Clients, Billing, Approvals, Inventory, Scheduling, HR, Projects, Reporting.
- Stays client-specific for Mizan: Matters, Hearings, law-firm workflows, legal
  terminology and rules, court/lawyer workflows — in `app/lawfirm/` unless future
  real projects prove otherwise.
- **Frontend reuse has a lower threshold**: reuse obvious primitives (Button,
  Input, Modal, Table, Form, Toast, Navigation) immediately. But no
  `GenericERPClientPage`, `UniversalBusinessDashboard`. Reuse patterns, not
  imagined abstractions.

---

## 44. Dependency Direction

```
AURIC CORE  ◀──  MIZAN  ◀──  { WEB, MOBILE }
```

Never `Core → Mizan`. Never `Core → Web`, `Core → Mobile`. Clients consume the
application API.

---

## 45. The Four Boundaries

1. Core vs Mizan
2. Backend vs Clients
3. Domain vs Infrastructure
4. Shared UI vs Feature UI

Keep them explicit.

---

## 47. Non-Negotiable Rules

1. AURIC Core must remain domain-agnostic.
2. Mizan is the first real product, not a generic ERP template.
3. Mizan lives in `app/lawfirm/`.
4. Do not create a reusable module library prematurely.
5. Rule of Three before extracting domain modules.
6. Backend is a modular monolith, not microservices.
7. Controllers are thin.
8. Business logic belongs in domain/application layers.
9. Infrastructure implements interfaces.
10. Backend authorization is authoritative.
11. Frontend permissions exist for UX, not security.
12. Tenant isolation is enforced by backend + PostgreSQL RLS.
13. Web and mobile consume the same backend.
14. Web and mobile may have different UX.
15. Shared API contracts are preferable to duplicated types.
16. Do not share UI components between Web and React Native merely for reuse.
17. Do not add infrastructure before the requirement exists.
18. Do not abstract code because it "might be reusable."
19. Prefer simple explicit architecture over speculative abstraction.
20. Every extraction into AURIC must be justified by real repeated usage.

---

## 48. Build Priority

```
PHASE 1  AURIC Core  +  Mizan Backend  +  Mizan Web     ← current
PHASE 2  Mizan Mobile
PHASE 3  Production infrastructure hardening
PHASE 4  Extract proven reusable modules into AURIC     ← after more clients
```

Proceed incrementally. The architecture describes the destination.

---

## 49. Current Frontend Mission

```
Mizan Web → production-quality UX → real law-firm workflows
          → permission-aware UI → API-ready architecture
          → reusable visual primitives
```

Do NOT spend this phase building: a generic ERP builder, module marketplace,
multi-industry UI, microservices, plugin system, or generic workflow/form/entity
engines. Future possibilities, not current requirements.

---

## 50. Definition of Success

The first milestone is **not** "we built a reusable ERP framework." It is:

> "We built Mizan as a serious law-firm application on top of AURIC Core, with
> clean boundaries that allow the reusable parts to be extracted later."
