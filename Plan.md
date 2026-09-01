# AURIC Foundation: Architecture and Build Specification

**A constitution for how AURIC's codebase evolves, not a blueprint of everything to build up front.**

---

## 0. The Governing Rule

> **If a feature has not been required by a real project, and cannot be justified as fundamental infrastructure, it does not belong in AURIC Core yet.**

Everything below serves that rule. This document describes the *shape* AURIC's foundation can grow into and the patterns to reach for when a real need appears. It is **not** a checklist to build before the first client. The detailed capability lists, the multi-version roadmap, and the domain feature menus are a **reference of what good looks like**, deliberately held at arm's length until a real project pulls each piece into existence.

The danger for AURIC is not being unable to build this. It is building too much of it before it is needed. The valuable asset is a codebase carrying real accumulated engineering experience, not an impressive architecture document. Build one real product, extract what survived contact with reality, build the next product with it, repeat. The rest of this file is the map, not the itinerary.

### How to read this document

- **Sections 1–6** are foundational decisions worth settling early: the philosophy, the stack, the modular-monolith shape, how modules talk, who owns data, and how events flow. These are cheap to decide now and expensive to change later.
- **Section 7** lists Core capabilities as a **menu**, with a clear "start here" minimum. Build only the minimum until a project asks for more.
- **Section 8** replaces a fixed roadmap with an **extraction-driven** version model. Nothing is scheduled by version number.
- **Section 9** is a **reference library of starting points**, not a set of products to build.

---

## 1. Philosophy Recap

Two layers, treated differently:

- **Core** — thin, versioned, reused across projects. Cross-cutting plumbing that barely changes between industries. Kept minimal, grown only when a real project or genuine infrastructure need justifies it.
- **Domain Modules** — humble, forkable reference implementations. Copied and adapted per client. Divergence is expected and accepted. Not products, just proven starting points.

The rule: **build, use, discover what repeats, extract, improve, reuse.** Client work is always primary. The Core grows out of real projects, never ahead of them, with the single deliberate exception of localization (built upfront because recurrence is certain for AURIC's market).

---

## 2. Technology Stack

Chosen to match AURIC's existing repos and expertise. One stack, done excellently, before considering any second implementation.

| Layer | Technology |
|---|---|
| Language | TypeScript (dominant across all repos) |
| Backend runtime | Node.js + Fastify |
| Database | PostgreSQL — the only datastore. Relational, transactional, holds all Core and domain data. No secondary database. |
| Queries & transactions | Kysely — typed query builder; owns all runtime SQL and the transaction boundary |
| Schema & migrations | Prisma — owns the schema definition and migration history. Its generated types are the source for Kysely's `Database` types (types flow Prisma → Kysely). Prisma Client is **not** used for runtime queries. |
| Validation | Zod — request schemas at the API boundary and startup config parsing |
| API style | REST, documented with OpenAPI |
| Auth | JWT access + refresh tokens; passwords hashed with Argon2 (argon2id) |
| Logging | pino — structured JSON, request-correlated |
| Background jobs | Queue-based worker, Postgres-backed; added only when a real job appears (see §6.1) |
| Real-time | WebSocket channel for notifications and live updates |
| Web frontend (later) | React + TypeScript + Tailwind CSS + shadcn/ui |
| Mobile frontend (later) | React Native (shared TypeScript domain types) |

Second implementations (.NET, Laravel, Django) are explicitly out of scope until the business is validated. The **business architecture** stays conceptually consistent even if a second runtime is ever added.

---

## 3. System Architecture

### 3.0 Architectural style: modular monolith

The system is a **modular monolith**: a single deployable application per client, organized into strictly bounded modules that communicate through interfaces (Section 4), not network calls. This is the right default for a small team building custom business software. It gives the discipline and clear boundaries of separate services without the operational cost of distributed systems.

The modules are logical boundaries, **not** separate services. Do not split them into microservices on a schedule or a request-count trigger. Split only under real architectural pressure: a piece that genuinely needs independent scaling, independent deployment, separate team ownership, failure isolation, or resource isolation. Absent one of those concrete pressures, a modular monolith is correct even at high traffic. The module boundaries in this spec are drawn so that *if* extraction is ever forced, it is possible, but that is an optimization for a future you may never reach.

### 3.1 Layered view

```
                     CLIENT APPLICATIONS
              (React Web  |  React Native Mobile)
                            │
                            ▼
                     HTTP / API LAYER
              (routing, auth middleware, request
               validation, rate limiting)
                     — in-process, part of the monolith,
                       NOT a separate gateway service —
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
    CORE LAYER         DOMAIN MODULES       ADAPTERS
   (plumbing)          (business logic)     (integrations)
        │                   │                   │
   Identity            Employee            Payment gateways
   RBAC                Inventory           ETA e-invoicing
   Organizations       Billing             SMS / email providers
   Files               Orders              File storage (S3-compatible)
   Audit               Cases               Third-party APIs
   Notifications       ...
   Localization
   Observability
   · · · · · · · · · · · · · · · · · · · · · · · · ·
   (added later, only when a project pulls them in:
    Tenancy · Events/Outbox · Workflow · Reporting)
        │                   │
        └─────────┬─────────┘
                  ▼
             DATA LAYER
      (PostgreSQL only — Kysely for queries and
       transactions, Prisma for schema and migrations)
```

### 3.2 Module anatomy

Every module (Core or domain) is structured identically, so any AURIC developer can navigate any module:

```
<module>/
├── domain/          business entities, value objects, domain rules
├── application/     use cases, services, orchestration
├── infrastructure/  DB repositories, external adapters
├── api/             REST controllers, route definitions
│   └── openapi.yaml
├── events/          published events + subscribers
├── permissions/     permission definitions for RBAC
├── validation/      input schemas (e.g. Zod)
├── migrations/      database migrations owned by this module
├── tests/           unit + integration tests
└── README.md        install, configure, integrate
```

### 3.3 Design rules per module

Every module must have:

- **Clear ownership** — which data it owns vs. which it references.
- **Clear boundaries** — what it does and explicitly does not do.
- **Clear contracts** — how other code communicates with it (interfaces, not direct table access).
- **Clear dependencies** — what Core services it requires.
- **Clear workflows** — what happens when its events fire.
- **Clear integration** — how it installs into a host system.
- **Clear extensibility** — what can be customized per client.

### 3.4 Request lifecycle (end to end)

The layered view (3.1) is static. This is the same architecture in motion: what actually happens from the moment a user acts to the moment data is stored. Every request follows this path, and each layer has exactly one job.

```
USER
 │  fills a form, clicks a button
 ▼
REACT (frontend)
 │  POST /api/employees  { name, email, departmentId, position }
 │  Authorization: Bearer <JWT>
 │  — knows the API contract. Knows nothing about the database. —
 ▼
HTTP / API LAYER            (in-process, part of the monolith)
 │  Router            → matches POST /employees → CreateEmployeeController
 │  Auth middleware   → verifies JWT → userId = usr_123
 │  Validation (Zod)  → shape, types, required fields
 │  Permission check  → can(userId, "employee:create", "employee")
 │                      → 403 Forbidden if denied
 │  Controller        → translates HTTP to a use-case call, nothing more
 │  — no business logic here. —
 ▼
APPLICATION LAYER
 │  CreateEmployeeUseCase — orchestrates the operation:
 │    BEGIN TRANSACTION
 │      1. validate referenced user     (via IUserProvider)
 │      2. validate referenced department
 │      3. build Employee entity        (domain decides initial status)
 │      4. persist it                   (via EmployeeRepository)
 │      5. record audit entry           (via IAuditLogger, same tx)
 │      6. publish employee.created     (via IEventBus, inside the tx)
 │    COMMIT
 │  — owns the transaction boundary. The event bus does not. (see §4, §6.1) —
 ▼
DOMAIN LAYER
 │  Employee entity: id, userId, departmentId, position, status
 │  Business rules: is this creation valid? what is the initial status
 │                  (ACTIVE vs PENDING)? which fields are required?
 │  — knows nothing about SQL, HTTP, Postgres, or React. Only the business. —
 ▼
INFRASTRUCTURE LAYER
 │  EmployeeRepository.create(employee)
 │  PostgreSQL adapter → INSERT INTO employees (...)
 │  — the only layer that knows the storage engine. —
 ▼
POSTGRESQL
    employees      row inserted   (emp_01)
    audit_logs     row inserted   (usr_123 · employee.created · emp_01)  — same transaction
```

The response travels back up the same stack — repository → use case → controller → HTTP → React — and the frontend renders `Employee Created ✓`.

**Side effects run off the event, not the request.** Once `employee.created` is published, other modules react without the Employee module knowing or caring who listens:

```
USE CASE
   │  publishes
   ▼
DOMAIN EVENT  (employee.created)
   ▼
EVENT BUS
   ├─▶ Audit          — internal, in-process bus, same transaction (§6.1)
   ├─▶ Notification    — external effect → transactional outbox (§6.1)
   ├─▶ Workflow        — e.g. start onboarding
   └─▶ External API    — via an adapter, through the outbox
```

**The rules this lifecycle enforces:**

- The **frontend** does not know the database.
- The **domain** does not know SQL, or any transport or storage technology.
- The **controller** contains no business logic — it only maps HTTP to a use case and back.
- The **use case** orchestrates and owns the transaction; the event bus runs inside it.
- The **repository** is the single place that knows the storage engine.
- A module **publishes** what happened; it never calls another module directly.

The same lifecycle is industry-agnostic. Swap the client domain — a restaurant instead of an HR system — and `CreateEmployeeUseCase` becomes `CreateOrderUseCase`, `employees` becomes `orders`, but every layer boundary, the transaction ownership, and the event flow are unchanged. Core (Identity, RBAC, Files, Audit, Notifications) is the shared set of capabilities the use case leans on; it is not an application stacked on top of the application.

---

## 4. Integration Contracts

Modules never reach directly into another module's tables or the host system's tables. They talk through **provider interfaces**. This is what prevents tight coupling and keeps modules forkable.

Core provider interfaces every domain module can depend on:

```typescript
interface IUserProvider {
  getUser(userId: string): Promise<User | null>;
  userExists(userId: string): Promise<boolean>;
}

interface IOrganizationProvider {
  getOrganization(orgId: string): Promise<Organization | null>;
  // No tenant context here. AURIC is single-tenant by default.
  // If a multi-tenant product ever appears, introduce a separate
  // ITenantContext then — do not bake tenancy into this contract now.
}

interface IPermissionProvider {
  can(userId: string, action: string, resource: string): Promise<boolean>;
  assignRole(userId: string, roleId: string): Promise<void>;
}

interface INotificationProvider {
  send(notification: NotificationPayload): Promise<void>;
}

interface IFileStorage {
  upload(file: FileInput): Promise<FileRef>;
  getUrl(fileRef: FileRef): Promise<string>;
  delete(fileRef: FileRef): Promise<void>;
}

interface IAuditLogger {
  record(entry: AuditEntry): Promise<void>;
}

// Publish-only. A module publishes what happened; it does not know
// who (if anyone) subscribes. Subscription is a registration concern
// wired up in the application/infrastructure layer, not part of this
// contract.
interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
}
```

> **Transaction ownership:** the `IEventBus` does not own or create transactions. The application/use-case layer opens the transaction, makes its domain changes, and publishes internal events **inside** that same transaction boundary. The bus is a mechanism that runs within a transaction the caller controls, never the thing that guarantees atomicity by itself.

A domain module (say Employee) references an existing user by **identifier** through `IUserProvider`. It does not build a duplicate user or auth system. The host owns identity; the module owns its own domain data.

---

## 5. Data Ownership Model

The most important integration discipline: every piece of data has exactly one owner.

**Example — Employee module inside a client that already has users:**

| Data | Owner |
|---|---|
| User account, login, password | Host / Core Identity |
| Organization, tenant | Host / Core |
| Authentication, sessions | Host / Core Identity |
| Employee profile (employment-specific) | Employee module |
| Attendance records | Employee module |
| Leave requests | Employee module |
| Employee documents | Employee module (via IFileStorage) |
| Contracts | Employee module |
| Employment history | Employee module |

The Employee module stores a reference (`userId`) to the identity the host owns, and layers employment data on top. It never duplicates the identity system.

---

## 6. Event System

Workflows are the real value, and they are driven by events. Modules publish events; other modules and workflows subscribe. This keeps modules decoupled.

**Example — employee termination workflow:**

```
Event: employee.terminated
        │
        ├─▶ Identity: deactivate user access
        ├─▶ RBAC: revoke active permissions
        ├─▶ Notifications: notify HR
        ├─▶ Audit: record termination event
        └─▶ Workflow: start offboarding process
```

Event conventions:

- Named `<module>.<pastTenseAction>` (e.g. `order.cancelled`, `invoice.paid`, `case.hearing_scheduled`).
- Carry a stable payload contract, versioned alongside the module.
- Handlers are idempotent (safe to re-run).
- Published through `IEventBus`, never by direct function calls between modules.

### 6.1 Two delivery mechanisms

There is a real distinction here that must not be blurred:

**In-process event bus (default for internal events).** For events whose handlers only touch the database (revoke permissions, write an audit record, update related rows), a simple in-process bus is correct. The key is that the **application/use-case layer owns the transaction**: it opens a transaction, applies its domain changes, and publishes internal events within that same boundary, so the handlers commit or roll back together with the originating change. This atomicity comes from the transaction the application layer manages, **not** from the event bus itself — the bus merely runs inside it. Introducing anything heavier for purely internal handlers is over-engineering.

**Transactional outbox (required for external-effect events).** For events that trigger side effects *outside* the database (send email/SMS, submit an e-invoice to the tax authority, call a payment gateway, fire a webhook), a plain bus risks inconsistency: the DB commit succeeds but the external call fails, or vice versa. For these, the event is written to an `outbox` table **in the same transaction** as the business data, and a background worker reads the outbox and performs the external call with retries. This turns an unreliable dual-write into a single atomic write.

- Internal-only handlers → in-process bus.
- Any handler with an external side effect → outbox.
- Do **not** apply the outbox everywhere; it adds a table, a worker, and monitoring, and is only worth it at the external boundary.

### 6.2 Failure handling

- External-effect events that fail after N retries go to a **dead-letter queue (DLQ)** with the original payload, error, and retry history, so they can be inspected and replayed, never silently dropped.
- The outbox worker is a silent background process; it **must** be monitored, because it can fail quietly while events pile up.

---

## 7. The Core: Capability Menu

This is a **menu of what Core capabilities can grow into**, not a build list. Each capability has a **Start here** minimum (build this when the capability is first needed) and **Later** items (add only when a real project asks). Applying the Governing Rule: build the Start-here line, ship, and let projects pull the Later items in.

### 7.1 Identity & Authentication
- **Start here:** register, login, logout, refresh, forgot password, email verification, secure password hashing (Argon2id).
- **Later (from real demand):** two-factor (TOTP), social/OAuth login, sophisticated session management/revocation, account lockout and brute-force protection.

### 7.2 RBAC (Role-Based Access Control)
- **Start here:** User, Role, Permission, Role→Permissions, User→Role, and `can(user, action, resource)`. That is enough for most systems.
- **Later (from real demand):** hierarchical roles, per-tenant role scoping, module-declared permission registries.

### 7.3 Tenancy

> **Built (2026-09-01).** A real shared-SaaS product pulled multi-tenancy in, so it now ships in Core exactly as prescribed below: an organization *is* the tenant, shared schema + `organization_id` + PostgreSQL RLS, global identity, tenant context per request on a restricted `auric_app` connection with `auric_system` (BYPASSRLS) for signup/webhooks/the worker. Design and rationale: [`docs/tenancy.md`](docs/tenancy.md); shape: `docs/architecture.md` → *Multi-tenancy*. The rest of this section is the original guidance, kept for the record.

**Default: single-tenant. One deployable, one client, one database.** Because AURIC's default is a dedicated deployment per client, there is usually no second tenant to isolate from, and cross-tenant leakage is impossible by design. Do not build multi-tenancy machinery for a system that serves one organization. This is the most common piece of speculative infrastructure to avoid.

**Add multi-tenancy only when a specific product actually serves many organizations from one instance** (for example, if AURIC ever runs a shared SaaS product rather than a per-client deployment). When that real need appears, the AURIC approach is:

- Shared schema with a `tenant_id` column on every tenant-scoped table
- PostgreSQL Row-Level Security (RLS) enforcing tenant filtering at the database level, so a missed `WHERE` clause in code cannot leak across tenants
- Tenant context set per request and read by RLS policies
- Database-per-tenant reserved as a premium isolation tier for enterprise clients who require and pay for it

> The point is not that RLS is wrong. It is excellent *when you have multiple tenants*. The point is that most AURIC deployments will not, so tenancy machinery waits for a product that genuinely needs it. If a build is single-tenant, skip this section entirely.

### 7.4 Organizations & Users
- **Start here:** organization entity, user-to-organization membership, basic org settings.
- **Later:** org hierarchy, invitations and onboarding flows.

### 7.5 Notifications
- **Start here:** in-app + email, templated (bilingual). Email delivery through the outbox (see 6.1).
- **Later:** SMS, push, real-time WebSocket delivery, per-user preferences, delivery-status tracking.

### 7.6 File Storage
- **Start here:** upload, download, delete, metadata, access control (via RBAC).
- **Later:** thumbnails/previews, virus-scan hook, file versioning.

### 7.7 Audit Logging
- **Start here:** immutable trail of significant actions (actor, action, resource, before/after, timestamp), queryable.
- **Later:** retention configuration, advanced querying/filtering.

### 7.8 Workflow & Approval Engine
- **Not yet.** Do not build a generic workflow engine up front. When the first project needs an approval, build that one approval concretely, in the module that needs it. Only after the same approval shape appears across **three** real projects should you extract a shared engine. A premature workflow engine is the single most over-built piece of infrastructure in ERP-style systems.
- *Eventual shape (only once earned):* multi-step chains, conditional routing, escalation, delegation, timeout/reminder handling, event-driven transitions.

### 7.9 Reporting
- **Not yet.** Start with the specific reports a project asks for, written plainly. Extract a reporting skeleton (filter/group/aggregate, export) only when the pattern has repeated enough to reveal its real shape.

### 7.10 Localization (see Section 12 for detail)
Pure presentation and language concerns. Keep this clean — it is **only** about language, direction, and formatting.
- **Start here (the one deliberate upfront investment):** Arabic RTL, Arabic-first UX, bilingual (AR/EN) content handling, AR-EG date/number/currency formatting.
- **Later:** Hijri date handling.

### 7.11 Integrations & Compliance (separate from Localization)
External systems and legal/compliance concerns. These are **not** localization; folding them into Localization pollutes the Core. They live as **adapters**, added only when a real project needs them.
- Egyptian ETA e-invoicing and local tax compliance
- Local payment gateways
- SMS providers
- Other third-party/external APIs

> The distinction matters: Localization is how the product *reads*; Integrations/Compliance is what the product *connects to and must legally satisfy*. A clean Core keeps them apart.

### 7.12 Observability
- **Start here:** structured logging with request correlation IDs, basic error tracking, a health-check endpoint.
- **Later:** metrics (latency, error rates, queue depth), alerting, and worker monitoring — the last of these becomes mandatory the moment you introduce the outbox, because the outbox worker fails invisibly.

---

## 8. Version Model (Extraction-Driven)

**There is no fixed roadmap. Do not decide today what a later version contains.** The Core version number simply records what has already survived contact with real projects. Let project #4 tell you what belongs in the Core, then #7, then #10. That is the entire point of the philosophy, and writing a v2/v3 feature list up front is exactly the framework-first trap this document exists to prevent.

```
AURIC Core
│
├── v0.1 — Foundation extracted from Project #1
│           (whatever plumbing that first real product actually needed)
│
├── v0.2 — Refined by Project #2
│           (what the second product proved was genuinely reusable)
│
├── v0.3 — Refined by Project #3
│           (patterns now seen three times start to earn their place)
│
└── v1.0 — Declared only once the architecture has proven itself
            across several real projects, not on a calendar
```

### What v0.1 realistically contains

Whatever Project #1 needs, and no more. For a typical first business system that is likely:

- Identity (register, login, logout, refresh, forgot password, email verification)
- RBAC (User, Role, Permission, `can()`)
- Organizations & Users (minimal)
- Files (upload, download, delete, metadata, access control)
- Audit (immutable trail, queryable)
- Notifications (in-app + email, templated)
- Localization start-here (Arabic RTL, bilingual, AR-EG formatting)
- Observability start-here (structured logging, error tracking, health check)

Notice what is **not** here: no multi-tenancy (single-tenant by default), no workflow engine, no reporting skeleton, no outbox (until the first external side effect appears), no SMS/push, no 2FA. Each of those enters a later version only when a real project pulls it in.

### The promotion rules that govern versions

- **Infrastructure** (auth, files, audit, logging) can enter Core quickly, because its shape is well understood.
- **Domain-flavored capabilities** need the **rule of three**: the same shape proven across three real, different projects before extraction. Two occurrences cannot tell you whether the similarity is real or coincidental; the wrong abstraction costs more than the duplication it replaces.
- **Patterns, not schedules:** the outbox, DLQ, and worker monitoring (Section 6) are documented and ready to reach for the moment a real external-effect event appears. They are not assigned to a version. E-invoicing will likely trigger the outbox early; let that need pull it in.

> **Governing Rule, restated:** if a feature has not been required by a real project and is not fundamental infrastructure, it does not belong in Core yet.

---

## 9. Domain Modules: Reference Library of Starting Points

**These are not products, and they are not a build list.** They are proven *starting points* that accumulate over time. Nothing here exists until a real project creates it. When a project needs, say, Employee Management, you copy the closest reference into that client's repo and reshape it around their actual business. Two clients' Employee modules are *supposed* to diverge; that divergence is the philosophy working, not a failure of reuse.

The feature bullets below sketch what a mature version of each starting point might cover, so you recognize the shape when it appears. Build only the slice a given client needs. A capability that says "via Workflow engine" or "e-invoicing" means *reach for that pattern if and when the client needs it*, not that those must exist first.

This library grows the same way the Core does: a module earns a stable, blessed reference version only after it has been built for **three** real, different clients and its true shape has revealed itself. Before that, each build is just a fork of the nearest prior one.

### 9.1 Employee Management (starting point)
- Employee lifecycle: create, update, suspend, terminate, transfer
- Department assignment
- Role/position assignment (references Core RBAC)
- Attendance tracking
- Leave requests and balances
- Contracts
- Employee documents (via IFileStorage)
- Employment history
- Approval flows (built concretely per client; extract a shared engine only once earned)
- Business rules per client

### 9.2 Inventory
- Products/items and categories
- Stock levels per location/branch
- Stock movements (in/out/transfer/adjustment)
- Reorder points and low-stock alerts
- Supplier links
- Inventory valuation
- Reservation against orders

### 9.3 Billing & Invoicing
- Invoices and line items
- Payment recording and status
- Taxes and discounts
- E-invoicing compliance (via the ETA integration adapter — see 7.11 / 12B)
- Credit notes
- Recurring billing (optional)
- Accounting hooks

### 9.4 Orders
- Order creation and lifecycle
- Order line items
- Status transitions (created → processing → fulfilled → paid)
- Cancellation handling and effects
- Links to inventory and payment
- Order events for downstream workflows

### 9.5 Suppliers & Purchasing
- Supplier records
- Purchase orders
- Purchase-to-inventory flow
- Supplier documents and contracts

### 9.6 Cases (legal/service verticals)
- Case records and lifecycle
- Assigned staff (references Employee/User)
- Hearings and sessions with scheduling
- Case documents
- Reminders (via Notifications)
- Billing links

### 9.7 Contracts & Documents (starting point)
- Document records and versions
- Contract lifecycle and expiry tracking
- Templated document generation (bilingual)
- Signatures/approvals (reach for a workflow pattern only if one has been earned)

### 9.8 Scheduling & Appointments
- Calendar/slot model
- Booking and cancellation
- Reminders
- Resource/staff assignment

> Any given client project pulls **only** the modules that fit, adapts them heavily, and builds client-specific logic where nothing reusable exists.

---

## 10. Repository and Directory Structure

### 10.1 The Project #1 repo (what you actually start with)

Do **not** scaffold a `modules/` library on day one. An empty `modules/employee/` folder is an invitation to build a generic module before you understand its shape. The first repo has the Core start-here capabilities and **one real client domain**, nothing more.

```
auric/
├── core/
│   ├── identity/
│   ├── rbac/
│   ├── organizations/
│   ├── files/
│   ├── audit/
│   ├── notifications/
│   ├── localization/
│   ├── observability/
│   └── contracts/               ← the provider interfaces (Section 4)
│
├── app/
│   └── <actual-client-domain>/  ← the real thing you are shipping (e.g. employee/)
│
├── docs/
│   ├── architecture.md
│   ├── integration-guide.md
│   └── conventions.md
│
└── package.json
```

The domain you build for Project #1 lives in `app/`, as ordinary client work. It is **not** a reusable module yet, because one build cannot tell you its reusable shape.

### 10.2 How `modules/` is born (only after real repetition)

```
Project #1  →  app/employee            (first real build)
Project #2  →  app/employee (again)    (second build, different client)
Project #3  →  app/employee (again)    (third build — the common shape is now visible)
        ↓
  extract  →  modules/employee/        (a blessed, forkable starting point is born)
```

Only once a domain has been genuinely built three times does a `modules/` starting point earn its existence. This is the rule of three applied to the repo itself.

### 10.3 The mature structure (what it grows into, later)

```
auric/
├── core/                        ← versioned, pinned per project (grows via extraction)
│   ├── identity/ rbac/ organizations/ files/ audit/
│   ├── notifications/ localization/ observability/ contracts/
│   └── (later, only when pulled in: tenancy/ events-outbox/ workflow/ reporting/)
│
├── modules/                     ← forkable starting points, each earned by 3 real builds
│   └── employee/  inventory/  billing/  ...
│
├── clients/                     ← one folder per real client project
│   ├── client-a/                ← pins core@0.1.0, forks what it needs
│   ├── client-b/                ← pins core@0.2.0, different mix
│   └── ...
│
└── docs/
    ├── architecture.md
    ├── integration-guide.md
    └── conventions.md
```

- **core/** is consumed as a versioned internal package. Client projects depend on a pinned version.
- **modules/** are copied into a client project and adapted, not depended on live.
- **clients/** each pin their own Core version and hold their client-specific logic.

---

## 11. Versioning and Release Strategy

### 11.1 Semantic versioning for the Core
- **Major (x.0.0):** breaking contract changes.
- **Minor (1.x.0):** new backward-compatible capabilities.
- **Patch (1.2.x):** bug/security fixes, no contract change.

### 11.2 Pinning
- Every client project pins an exact Core version (e.g. `core@1.2.0`).
- Core changes do **not** auto-flow into shipped client systems.

### 11.3 Upgrading a client
- Upgrading a client's pinned Core version is deliberate maintenance work, scheduled and tested, never automatic.
- Security patches get prioritized upgrade windows across clients.

### 11.4 Module (domain) versioning
- Domain modules are copied per client, so they diverge by design.
- No live shared version. Improvements flow by **re-forking or manual porting**, chosen deliberately.
- A domain capability only becomes a versioned Core-adjacent package after proving itself across **three real, different clients**.

### 11.5 The extraction ritual
- A scheduled review (monthly or per project close) asks: what did we build again that is stable enough to promote?
- Infrastructure → promote to Core quickly.
- Domain code → hold until the three-client bar is met.

---

## 12. Localization and Integrations (Detailed)

Together these are the most durable competitive edge for AURIC's market. But they are **two different concerns** and are kept separate on purpose.

### 12A. Localization (presentation and language)

The one deliberate upfront investment. Pure language, direction, and formatting.

**Language & UX**
- Full Arabic RTL layout support across all Core UI primitives
- Arabic-first UX patterns (not a bolted-on translation)
- Bilingual (AR/EN) content model for all user-facing strings and data
- Locale-aware formatting: numbers, currency (EGP), dates

**Dates**
- Gregorian and Hijri calendar support
- Hijri date display and input where relevant

### 12B. Integrations & Compliance (adapters, added on demand)

**Not** localization. These are external-system adapters and legal-compliance concerns, built only when a real project needs them, and living in the adapters/integrations layer rather than in Localization.

**Compliance**
- Egyptian electronic invoicing (ETA e-invoice) compliance in billing/invoicing
- Local tax handling
- Compliant invoice document generation

**Payments**
- Local payment gateway integrations
- Payment status handling wired into orders/billing

> Global competitors (Odoo, Salesforce, offshore generalists) handle both the Arabic-first experience and the local compliance badly. That is the edge. Keeping Localization and Integrations separate is what stops the Core from turning into a tangle of Egypt-specific rules embedded in presentation code.

---

## 13. What a Client Project Looks Like

The end-to-end assembly for any new client:

```
Existing AURIC Core (pinned version)
        +
Selected forkable domain modules
        ▼
Client requirements gathered
        ▼
Customize / extend / remove / rework modules
        ▼
Build client-specific business logic + workflows
        ▼
Apply client branding + identity
        ▼
Wire integrations (payments, e-invoicing, third-party)
        ▼
Final fully customized product delivered
```

The client receives a bespoke system built around their business. AURIC delivers it faster, more consistently, and at higher margin because the plumbing and localization came from a stable, versioned Core, and the domain modules gave a running start instead of a blank repo.

---

## 14. Stop Designing. Start Extracting.

This document is now complete enough. The single largest remaining risk to AURIC is **not** a missing architectural decision. It is spending more time refining this constitution than building the thing it describes. Every further pass on the spec has sharply diminishing returns; the next real improvement to the architecture will come from a real project, not another edit.

So the constitution ends with a hard stop:

> **Do not write more architecture. Define AURIC Project #1 and build the smallest production-capable foundation required to ship it.**

Concretely, the next move is **not** to build Core v0.2, an Employee module, an Inventory module, a workflow engine, a reporting engine, multi-tenancy, or any generic abstraction. It is:

```
REAL CLIENT
     ↓
REAL REQUIREMENTS
     ↓
BUILD (core start-here + one app/ domain)
     ↓
PAIN / DUPLICATION / PATTERNS
     ↓
EXTRACT (only what genuinely repeated)
     ↓
AURIC CORE grows by one honest increment
     ↓
NEXT CLIENT
     ↓
REFINE
```

That loop is what turns AURIC into an engineering company with accumulated, hard-won IP, instead of a company with an impressive framework and no customers. The architecture is ready. The next artifact you produce should be a shipped product, not a longer document.

---

## Appendix: One-Line Summary

> A thin, versioned **Core** that starts minimal (identity, RBAC, orgs, files, audit, notifications, Arabic-first localization, basic observability) and grows only from real projects, plus a **library of forkable domain starting points** each earned by three real builds, assembled and heavily customized per client. Single-tenant by default; multi-tenancy, workflow, reporting, the outbox, and local integrations/compliance are added only when a real project pulls them in. Never built as a universal framework first.