# Project-404: one foundation, three products

![NestJS 11](https://img.shields.io/badge/NestJS-11-e0234e) ![Fastify](https://img.shields.io/badge/Fastify-5-000000) ![PostgreSQL + RLS](https://img.shields.io/badge/PostgreSQL-RLS-336791) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

| **Overview** | [Mizan](docs/products/mizan.md) | [Atlas](docs/products/atlas.md) | [HotelOS](docs/products/hotelos.md) | [Security](SECURITY.md) |
|:---:|:---:|:---:|:---:|:---:|

Project-404 is a **domain-agnostic application foundation** with **three independently deployed products**
built on it. The foundation handles identity, permissions, multi-tenancy, files, audit, notifications,
events and AI orchestration. The products cover three very different businesses: a law firm, a real-estate
developer and a hotel.

The foundation (`core/`) is the engine and knows nothing about any business. Each product brings its own
domain, its own database and its own apps, and reaches Core only through published contracts. None of the
three re-implements sign-in, tenancy, permissions, file storage, an audit trail or event delivery.

<table>
  <tr>
    <td width="33%"><a href="docs/products/mizan.md"><img src="docs/screenshots/mizan/dashboard.png" alt="Mizan dashboard"></a></td>
    <td width="33%"><a href="docs/products/atlas.md"><img src="docs/screenshots/atlas/dashboard.png" alt="Atlas executive dashboard"></a></td>
    <td width="33%"><a href="docs/products/hotelos.md"><img src="hotel-project/docs/screenshots/dashboard.png" alt="HotelOS dashboard"></a></td>
  </tr>
  <tr>
    <td align="center"><b><a href="docs/products/mizan.md">Mizan</a></b><br>Law-firm management</td>
    <td align="center"><b><a href="docs/products/atlas.md">Atlas</a></b><br>Real-estate developer OS</td>
    <td align="center"><b><a href="docs/products/hotelos.md">HotelOS</a></b><br>Hotel operations</td>
  </tr>
</table>

---

## Contents

- [The products](#the-products)
- [Why one foundation](#why-one-foundation)
- [Architecture](#architecture)
- [Core capabilities](#core-capabilities)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Known limitations](#known-limitations)
- [Documentation](#documentation)

---

## The products

| | Product | Business | Apps | Status | Details |
|---|---|---|---|---|---|
| **`mizan/`** | **Mizan** | Law firms: matters, hearings, clients, documents, billing | web · mobile (Expo) | live · 202 tests | [Mizan tab →](docs/products/mizan.md) |
| **`atlas/`** | **Atlas** | Property developers: CRM, inventory, sales, installments | web | live · 85 tests | [Atlas tab →](docs/products/atlas.md) |
| **`hotel-project/`** | **HotelOS** | Hotels: reservations, front desk, housekeeping, finance | staff app · public website | 8 slices done · 197 tests + 54 E2E runs | [HotelOS tab →](docs/products/hotelos.md) |
| **`core/`** | **Core** | None: the reusable platform | — | 13 capabilities | [core/README.md](core/README.md) |

Every product is its own deployable, with its own process, PostgreSQL database and seed data. The products
share `core/` as **source code**. They never share a running process or a database schema.

## Why one foundation

Most business software spends its first months on the same plumbing: sign-in, roles, tenants, uploads, an
audit trail, emails and background jobs. Project-404 builds that plumbing once, properly, and then proves it
by shipping products on top of it:

1. **Mizan** came first and shaped Core's contracts.
2. **Atlas** was built in a completely different domain to show which parts of Core were really reusable
   and which were quietly shaped like a law firm.
3. **HotelOS** is the third product. It's the one the **Rule of Three** was waiting for: code is only
   extracted into a shared module once three real products need it.

Each product took a fraction of the first one's effort, because none of them rebuilt the foundation.

## Architecture

```
   CLIENTS        mizan/web · mizan/mobile      atlas/web             hotel-project/app · hotel-project/web
                  React 19 + Vite / Expo        React 19 + Vite       React 19 + Vite (staff app · public site)
                         │                          │                              │
                         │   HTTP / JSON only: no client shares code with any server
                         ▼                          ▼                              ▼
   PRODUCT        mizan/backend/app/lawfirm/    atlas/backend/app/    hotel-project/backend/app/hotel/
   BACKENDS       :3000 · database: auric       realestate/ · :3100   :3200 · database: hotelos
                                                database: atlas
                         │                          │                              │
                         │   core/contracts interfaces + DI tokens only, never a Core table
                         ▼                          ▼                              ▼
                   ──────────────────────────  PROJECT-404 CORE  ──────────────────────────
                   identity · rbac · organizations · tenancy · files · audit · notifications
                   events + outbox · messaging · assistant · localization · observability · http
                                                 │
                                                 ▼
                   INFRASTRUCTURE   PostgreSQL (+ row-level security) · local disk / R2 · SMTP
```

Every request in every product follows the same pipeline, and the server enforces every step:

```
 HTTP request ──► JwtAuthGuard ──► PermissionGuard ──► Zod validation ──► use case
                  (who)            (may they?)         (well-formed?)         │
                                                                              ▼
            ┌──────────────────── one database transaction ────────────────────┐
            │  SET LOCAL app.organization_id (RLS)  →  domain rules  →  persist │
            │  →  audit record  →  domain event  →  outbox row (if external)    │
            └───────────────────────────────────────────────────────────────────┘
                                                                              │
          outbox worker ──► email · webhooks · AI (retries + dead-letter queue) ◄┘
```

| Principle | How it shows up |
|---|---|
| **Modular monolith, not microservices** | Each product is one NestJS process made of feature modules. Three products means three processes, not a service mesh. |
| **Core never knows a domain** | `core/` never imports from a product. A `Matter`, `Lead` or `Reservation` in Core is a bug. |
| **The database is the security boundary** | Row-level security and `organization_id NOT NULL` on every tenant table, so a forgotten `WHERE` can't leak data across tenants. See the [Security tab](SECURITY.md). |
| **Every use case owns its transaction** | Authenticate, validate, open a transaction, persist, then publish events. |
| **Prisma for schema, Kysely at runtime** | Prisma defines tables and migrations and generates types. At runtime all SQL is typed Kysely; there's no ORM. |
| **Money is exact** | Integer arithmetic and server-computed totals. Balances come from ledgers, never from an `isPaid` flag. |
| **No fake UI** | Every number, list and chart comes from the database. Demo data is played through the real workflows. |

## Core capabilities

| Capability | Module | Used by |
|---|---|---|
| Identity: register, login, refresh-token rotation, email verification, password reset, Argon2id | `core/identity` | all three |
| RBAC: roles, `action:resource` permissions, wildcards, server-side guards | `core/rbac` | all three |
| Organizations and membership (an organization **is** the tenant) | `core/organizations` | all three |
| **Multi-tenancy**: shared schema, per-transaction tenant context, PostgreSQL RLS | `core/kernel/tenant` | all three |
| Files: presigned uploads to local disk or Cloudflare R2, permission-checked downloads | `core/files` | all three |
| Audit: append-only trail, immutability enforced by the database | `core/audit` | all three |
| Notifications: in-app and email, templated per locale | `core/notifications` | all three |
| Events: in-process bus, **transactional outbox**, worker, dead-letter queue | `core/events` | all three |
| Messaging: real-time conversations over Socket.IO | `core/messaging` | Atlas |
| **AI orchestration**: provider boundary, permission-checked tools, conversation store | `core/assistant` | Mizan, Atlas |
| Localization: language and direction, Arabic formatters | `core/localization` | Mizan |
| Observability: structured logs, correlation IDs, health checks | `core/observability` | all three |
| HTTP: Zod validation, auth and permission guards, error filter, OpenAPI | `core/http` | all three |

Each capability documents its contract next to the code; start at [core/README.md](core/README.md).

## Tech stack

| Layer | Choices |
|---|---|
| Backend | Node 24, TypeScript (strict), NestJS 11 on Fastify, SWC |
| Data | PostgreSQL 12+ with row-level security, Prisma (schema and migrations), Kysely (runtime SQL) |
| Web | React 19, Vite, Tailwind CSS 4, TanStack Query |
| Mobile | Expo / React Native (Mizan) |
| AI | OpenAI-compatible provider boundary (Groq in production) |
| Testing | Vitest, Playwright |
| Hosting | AWS VPS (systemd + nginx) for APIs, Vercel for web frontends, Cloudflare R2 for files |

## Getting started

Prerequisites: Node **22.12+** or **24**, PostgreSQL **12+**, and Docker if you want the one-command Mizan setup.

```bash
git clone https://github.com/real-GBOY/Project-404.git
cd Project-404
npm install        # Core and the Mizan backend; the HotelOS backend uses these packages too
```

Each product then runs on its own. Every product tab has full setup steps and demo accounts:

| Product | Quick start | Web app |
|---|---|---|
| Mizan | `docker compose up --build` | http://localhost:4300 |
| Atlas | `cd atlas/backend && ATLAS_SEED_DEMO=true npm run serve` | http://localhost:4400 |
| HotelOS | `cd hotel-project/backend && npm run dev` | http://localhost:4600 |

Demo databases use the password `demo-password-2026` for every account.

## Testing

| Product | Suite | Tests |
|---|---|---|
| Core + Mizan | Backend: unit, integration, authorization, tenant isolation, RLS, outbox | 124 |
| Mizan | Web (Vitest) | 78 |
| Atlas | Backend + web, plus a live AI-provider suite | 80 + 5 |
| HotelOS | Backend (including concurrent-booking races) + staff app | 139 + 58 |
| HotelOS | End to end (Playwright, real backend, desktop and phone) | 27 scenarios × 2 |

Tenant isolation is tested directly: the harness runs Core as the restricted database role, so tests prove
tenant A can't read tenant B even when the application code gets a query wrong.

## Project layout

```
Project-404/
├── core/                   the reusable foundation: domain-agnostic, versioned
│   ├── kernel/             config · db · tenant · clock · errors · DI tokens
│   ├── contracts/          the interfaces every product uses to reach Core
│   └── identity/ rbac/ organizations/ audit/ files/ notifications/ events/
│       messaging/ assistant/ localization/ observability/ http/ bootstrap/
├── mizan/                  Product 1: law firm (backend/app, web, mobile)
├── atlas/                  Product 2: real estate (backend, web), own database
├── hotel-project/          Product 3: HotelOS (backend, app, web), own database
├── packages/               @auric/web (shared HTTP client) · create-auric (project scaffolder)
├── prisma/                 Core + Mizan schema and migrations
├── docs/                   architecture, tenancy, product pages, deployment, conventions
├── scripts/                migrate · provision-db · build · deploy
└── main.ts                 Mizan entrypoint
```

Every module has the same shape (`domain / application / infrastructure / api / events / permissions /
validation / tests`), so a developer who knows one product can find their way around any other.

## Known limitations

- **CI is manual.** The GitHub workflow runs on demand, and deployments are done by hand.
- **Roles are global per deployment.** Core roles aren't per-tenant yet.
- **Updates poll.** Notifications and dashboards refresh on a timer; only Atlas messaging is real-time.
- **The Rule of Three is due.** HotelOS is the third product, so the next step is deciding what to extract
  into shared modules.

Product-specific limitations are listed on each product tab.

## Documentation

| Document | Covers |
|---|---|
| [docs/engineering-overview.md](docs/engineering-overview.md) | The whole system in one file |
| [Plan.md](Plan.md) | The governing rules |
| [docs/system-architecture.md](docs/system-architecture.md) | The long-term vision |
| [docs/architecture.md](docs/architecture.md) | Core as built |
| [docs/mizan-project-one.md](docs/mizan-project-one.md) | The boundary between Core and a product |
| [docs/tenancy.md](docs/tenancy.md) | Multi-tenancy design |
| [docs/integration-guide.md](docs/integration-guide.md) | Building a new product on Core |
| [docs/conventions.md](docs/conventions.md) | Code conventions |
| [docs/database-erd.md](docs/database-erd.md) | The schema as an ER diagram |
| [SECURITY.md](SECURITY.md) | Security model and how to report a vulnerability |

## License

[MIT](LICENSE).
