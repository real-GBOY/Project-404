# Project-404: one foundation, five products

![NestJS 11](https://img.shields.io/badge/NestJS-11-e0234e) ![Fastify](https://img.shields.io/badge/Fastify-5-000000) ![PostgreSQL + RLS](https://img.shields.io/badge/PostgreSQL-RLS-336791) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

| **Overview** | [Mizan](docs/products/mizan.md) | [Atlas](docs/products/atlas.md) | [HotelOS](docs/products/hotelos.md) | [Raqib](docs/products/raqib.md) | [Admit](docs/products/admit.md) | [Security](SECURITY.md) |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|

Project-404 is a **domain-agnostic application foundation** with **five independently deployed products**
built on it. The foundation handles identity, permissions, multi-tenancy, files, audit, notifications,
events and AI orchestration. The products cover five very different businesses: a law firm, a real-estate
developer, a hotel, a security-guarding company and an event organizer.

The foundation (`core/`) is the engine and knows nothing about any business. Each product brings its own
domain, its own database and its own apps, and reaches Core only through published contracts. None of the
five re-implements sign-in, tenancy, permissions, file storage, an audit trail or event delivery.

<table>
  <tr>
    <td width="20%"><a href="docs/products/mizan.md"><img src="docs/screenshots/mizan/dashboard.png" alt="Mizan dashboard"></a></td>
    <td width="20%"><a href="docs/products/atlas.md"><img src="docs/screenshots/atlas/dashboard.png" alt="Atlas executive dashboard"></a></td>
    <td width="20%"><a href="docs/products/hotelos.md"><img src="hotel-project/docs/screenshots/dashboard.png" alt="HotelOS dashboard"></a></td>
    <td width="20%"><a href="docs/products/raqib.md"><img src="docs/screenshots/raqib/dashboard.png" alt="Raqib quality overview"></a></td>
    <td width="20%"><a href="docs/products/admit.md"><img src="docs/screenshots/admit/dashboard.png" alt="Admit organizer overview"></a></td>
  </tr>
  <tr>
    <td align="center"><b><a href="docs/products/mizan.md">Mizan</a></b><br>Law-firm management</td>
    <td align="center"><b><a href="docs/products/atlas.md">Atlas</a></b><br>Real-estate developer OS</td>
    <td align="center"><b><a href="docs/products/hotelos.md">HotelOS</a></b><br>Hotel operations</td>
    <td align="center"><b><a href="docs/products/raqib.md">Raqib</a></b><br>Security quality and field inspection</td>
    <td align="center"><b><a href="docs/products/admit.md">Admit</a></b><br>Event ticketing</td>
  </tr>
</table>

---

## Contents

- [The products](#the-products)
- [Raqib at a glance](#raqib-at-a-glance)
- [Admit at a glance](#admit-at-a-glance)
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
| **`raqib/`** | **Raqib** | Security-guarding companies: site inspections, review and approval, corrective actions, guard scoring, training | web (offline-capable PWA) | live · 373 + 58 tests + 57 E2E | [Raqib tab →](docs/products/raqib.md) |
| **`admit/`** | **Admit** | Event organizers: ticket sales with manual payment verification, QR tickets, door check-in, email worker | web (customer site · dashboard · scanner) · Python email worker | live · 77 backend + 26 worker + 31 web tests + 10 E2E | [Admit tab →](docs/products/admit.md) |
| **`core/`** | **Core** | None: the reusable platform | — | 13 capabilities | [core/README.md](core/README.md) |

Every product is its own deployable, with its own process, PostgreSQL database and seed data. The products
share `core/` as **source code**. They never share a running process or a database schema.

## Raqib at a glance

Raqib is the newest product, and the one that pushed the foundation hardest: field work with no signal,
personal data that must be encrypted at rest, and an approval trail nobody may rewrite.

![Raqib review and approval](docs/screenshots/raqib/review.png)

| | |
|---|---|
| **Offline-first field inspections** | A service worker and an IndexedDB outbox let inspectors answer, write notes and take photos with no signal, survive a reload offline, and replay everything in order on reconnect. A browser test cuts the network to prove it. |
| **History that can't be rewritten** | Published form versions, an inspection's item snapshot, issued reports and every workflow history are immutable through database triggers. An inspection always shows the form version it ran on. |
| **Authorization as a build failure** | All 141 routes sit behind a fail-closed guard (a handful are explicitly public, such as sign-in and account requests), and a static test fails the build if a route lacks a declared permission. 14 modules by 8 rights, scoped to dated project assignments, with "nobody approves their own work" rules on top. |
| **A confidential area no role can open** | Separate tables and a separate rule: an expiring, revocable grant issued by the General Manager, a logged entry with a stated reason, and a reporter identity stored apart and revealed only through a logged action. |
| **Encryption and abuse controls** | National IDs and two-step secrets sealed with AES-256-GCM and a keyed blind index. Lockout, TOTP with recovery codes, session revocation. Uploads are content-sniffed, stripped of GPS metadata and optionally virus-scanned. |
| **Real reports and exports** | Arabic and English report PDFs made in the browser from the frozen snapshot (no server renders anything), plus CSV and native Excel workbooks from a hand-written xlsx writer. Files go to Cloudflare R2 over presigned URLs, with abandoned uploads cleaned up nightly. |
| **Client-driven workflows** | Scoring from 100 with versioned, client-approved deductions; several forms in one visit; escalation of late corrective actions at 3, 6 and 9 days; supervisor-then-manager training approvals; project ranking by observations, improvement, complaints and contract expiry; confidential surveys for guards. The client's own values are configuration. The 20 requirements are tracked in [the requirements matrix](raqib/docs/RAQIB_REQUIREMENTS_MATRIX.md). |
| **Arabic and right-to-left throughout** | 38 designed screens plus the account and survey screens, and 1,977 interface strings in Arabic and English, mirrored properly rather than translated at the edges. A test fails the build if the code asks for a string that does not exist. |
| **The numbers** | 141 routes · 41 forced-RLS tables · 8 roles · 373 backend tests, 58 web tests and 57 browser tests in real Chrome (plus a read-only smoke test for the live site). The demo company is seeded by playing a year of inspections through the real workflows. |

[Raqib tab →](docs/products/raqib.md)

## Admit at a glance

Admit is the newest product. It sells event tickets where guests pay the organizer directly (InstaPay, a wallet, a bank transfer) and a person
verifies the transfer by hand, and it's the first product with a **non-Node part**: a Python worker that sends its email.

![Admit payment review](docs/screenshots/admit/review.png)

| | |
|---|---|
| **Never oversells** | A booking locks the ticket types and counts held seats from live bookings (there is no counter to drift). A test books the last 2 seats 6 times at once; exactly 2 succeed. |
| **Approve once, admit once** | Version-checked payment decisions (4 simultaneous approvals: 1 winner, 2 tickets, 1 email) and one atomic check-in update (8 simultaneous scans: 1 admitted, the rest told when and where the first happened). |
| **Guests without accounts** | A booking is reached through an unguessable link, never the public reference alone. QR tokens are an HMAC of the ticket id under a server key; only their SHA-256 is stored. |
| **A durable email outbox with a Python worker** | The API writes each complete, already-decided email into a product-owned table in the same transaction as the change. The worker claims rows with `FOR UPDATE SKIP LOCKED`, renders seven templates and sends over SMTP with leases and backoff. A failed email never invalidates a ticket. |
| **QR codes anyone can scan** | The QR holds the organizer's picture URL plus `#<token>`: a phone camera opens the picture, the door scanner reads the token. |
| **Tenancy and permissions** | An organizer is a Core organization; 13 tenant tables with forced RLS; 22 permissions across 5 roles; anyone below an owner reaches only the events they are assigned. |
| **The numbers** | 77 backend tests on real PostgreSQL, 28 worker tests, 31 web tests and 13 browser tests in real Chrome. Core gained one generic CORS header (`idempotency-key`) and nothing else. |

[Admit tab →](docs/products/admit.md)

## Why one foundation

Most business software spends its first months on the same plumbing: sign-in, roles, tenants, uploads, an
audit trail, emails and background jobs. Project-404 builds that plumbing once, properly, and then proves it
by shipping products on top of it:

1. **Mizan** came first and shaped Core's contracts.
2. **Atlas** was built in a completely different domain to show which parts of Core were really reusable
   and which were quietly shaped like a law firm.
3. **HotelOS** is the third product. It's the one the **Rule of Three** was waiting for: code is only
   extracted into a shared module once three real products need it.
4. **Raqib** is the fourth, in a regulated, offline-heavy domain. It stress-tested Core with field-level
   encryption, immutable approval trails, an isolated confidential area and Cloudflare R2 storage, and it
   is the first product to need most of them.

5. **Admit** is the fifth, a ticketing product with public guest checkout. It proved Core could carry
   anonymous traffic (guests are served inside the organizer's tenant context, so RLS still applies) and a
   consumer in another language: its email is delivered by a Python worker over a transactional outbox, with
   one generic CORS header added to Core.

Each product took a fraction of the first one's effort, because none of them rebuilt the foundation.

## Architecture

```
   CLIENTS      mizan/web · mobile    atlas/web          hotel-project/app · web     raqib/web (offline PWA)    admit/web
                React 19 · Expo       React 19 + Vite    React 19 + Vite             React 19 + Vite            React 19 + Vite
                      │                   │                       │                          │                      │
                      │   HTTP / JSON only: no client shares code with any server
                      ▼                   ▼                       ▼                          ▼                      ▼
   PRODUCT      mizan/backend/        atlas/backend/     hotel-project/backend/      raqib/backend/app/raqib/   admit/backend/
   BACKENDS     app/lawfirm/          app/realestate/    app/hotel/                  :3300 · database: raqib    app/admit/ :3400
                :3000 · db: auric     :3100 · db: atlas  :3200 · db: hotelos                                    db: admit
                                                                                                                + Python email worker
                      │                   │                       │                          │                      │
                      │   core/contracts interfaces + DI tokens only, never a Core table
                      ▼                   ▼                       ▼                          ▼                      ▼
                ─────────────────────────────  PROJECT-404 CORE  ─────────────────────────────
                identity · rbac · organizations · tenancy · files · audit · notifications
                events + outbox · messaging · assistant · localization · observability · http
                                                 │
                                                 ▼
                INFRASTRUCTURE   PostgreSQL (+ row-level security) · local disk / Cloudflare R2 · SMTP
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
| **Modular monolith, not microservices** | Each product is one NestJS process made of feature modules. Five products means five processes, not a service mesh. |
| **Core never knows a domain** | `core/` never imports from a product. A `Matter`, `Lead` or `Reservation` in Core is a bug. |
| **The database is the security boundary** | Row-level security and `organization_id NOT NULL` on every tenant table, so a forgotten `WHERE` can't leak data across tenants. See the [Security tab](SECURITY.md). |
| **Every use case owns its transaction** | Authenticate, validate, open a transaction, persist, then publish events. |
| **Prisma for schema, Kysely at runtime** | Prisma defines tables and migrations and generates types. At runtime all SQL is typed Kysely; there's no ORM. |
| **Money is exact** | Integer arithmetic and server-computed totals. Balances come from ledgers, never from an `isPaid` flag. |
| **No fake UI** | Every number, list and chart comes from the database. Demo data is played through the real workflows. |

## Core capabilities

| Capability | Module | Used by |
|---|---|---|
| Identity: register, login, refresh-token rotation, email verification, password reset, Argon2id | `core/identity` | all five |
| RBAC: roles, `action:resource` permissions, wildcards, server-side guards | `core/rbac` | all five |
| Organizations and membership (an organization **is** the tenant) | `core/organizations` | all five |
| **Multi-tenancy**: shared schema, per-transaction tenant context, PostgreSQL RLS | `core/kernel/tenant` | all five |
| Files: presigned uploads to local disk or Cloudflare R2 (one bucket per product, or a folder per product), permission-checked downloads | `core/files` | all five |
| Audit: append-only trail, immutability enforced by the database | `core/audit` | all five |
| Notifications: in-app and email, templated per locale | `core/notifications` | Mizan, Atlas, HotelOS, Raqib |
| Events: in-process bus, **transactional outbox**, worker, dead-letter queue | `core/events` | Mizan, Atlas, HotelOS, Raqib (Admit uses its own outbox for its Python worker) |
| Messaging: real-time conversations over Socket.IO | `core/messaging` | Atlas |
| **AI orchestration**: provider boundary, permission-checked tools, conversation store | `core/assistant` | Mizan, Atlas |
| Localization: language and direction, Arabic formatters | `core/localization` | Mizan |
| Observability: structured logs, correlation IDs, health checks | `core/observability` | all five |
| HTTP: Zod validation, auth and permission guards, error filter, OpenAPI | `core/http` | all five |

Each capability documents its contract next to the code; start at [core/README.md](core/README.md).

## Tech stack

| Layer | Choices |
|---|---|
| Backend | Node 24, TypeScript (strict), NestJS 11 on Fastify, SWC |
| Data | PostgreSQL 12+ with row-level security, Prisma (schema and migrations), Kysely (runtime SQL) |
| Web | React 19, Vite, Tailwind CSS 4, TanStack Query |
| Mobile | Expo / React Native (Mizan) · installable offline PWA (Raqib) |
| AI | OpenAI-compatible provider boundary (Groq in production) |
| Email worker | Python 3.12, psycopg, Jinja2 (Admit): a durable outbox in PostgreSQL, `FOR UPDATE SKIP LOCKED` |
| Testing | Vitest, Playwright (real Chrome), pytest |
| Hosting | VPS (systemd + nginx) for the APIs (Raqib and Admit on the Interserver VPS, the others on a shared AWS box), Vercel for web frontends, Cloudflare R2 for files (`mizan-files`, `raqib-files`, `admit-files`) |

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
| Raqib | `cd raqib/backend && npm run migrate && npm run dev`, then `cd ../web && npm run dev` (see [raqib/README.md](raqib/README.md)) | http://localhost:4500 |
| Admit | `cd admit/backend && npm run serve`, then `cd ../web && npm run dev` (see [admit/README.md](admit/README.md)) | http://localhost:4700 |

Demo databases use the password `demo-password-2026` for every account. Raqib's web app and the HotelOS public
website both default to port 4500, so run one at a time or change a port.

## Testing

| Product | Suite | Tests |
|---|---|---|
| Core + Mizan | Backend: unit, integration, authorization, tenant isolation, RLS, outbox | 124 |
| Mizan | Web (Vitest) | 78 |
| Atlas | Backend + web, plus a live AI-provider suite | 80 + 5 |
| HotelOS | Backend (including concurrent-booking races) + staff app | 139 + 58 |
| HotelOS | End to end (Playwright, real backend, desktop and phone) | 27 scenarios × 2 |
| Raqib | Backend: real HTTP, authorization, RLS on every table, security, retention, jobs, scoring, surveys, training chains | 373 |
| Raqib | Web unit tests, including architecture rules and a check that every string key exists | 58 |
| Raqib | End to end (Playwright, real Chrome and backend): offline work, MFA, lockout, downloads, a full inspection-to-closure workflow, surveys, training chains | 57 |
| Raqib | Live smoke test (read-only, against a running deployment; skipped unless pointed at one) | 8 |
| Admit | Backend: migrate-from-zero, RLS on every table, the booking-to-ticket journey, concurrency (overselling, double approval, double check-in), demo seeder | 77 |
| Admit | Email worker (pytest): rendering of all 7 emails, claim, lease, backoff and final failure | 28 |
| Admit | Web unit tests: validation, scanner and status state machines, readiness | 31 |
| Admit | End to end (Playwright, real Chrome and backend): book, upload, approve, real QR codes, door scan once, permission and privacy checks, the door flow on a phone, passwords, CSV exports, the audit log | 13 |

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
├── raqib/                  Product 4: security quality (backend, web, docs), own database
├── admit/                  Product 5: event ticketing (backend, web, Python email worker, docs, deploy), own database
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
- **The Rule of Three is due, and Raqib adds candidates.** Its field-level encryption, offline queue and PDF
  renderer live in the product today; deciding what to extract into shared modules is the next step.

- **Admit's live email goes out through a Gmail account** (an app password in the server's `.env`): fine for a demo, not for real customer volume. See [docs/admit-deployment.md](docs/admit-deployment.md).

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
| [docs/raqib-deployment.md](docs/raqib-deployment.md) | How Raqib is deployed: VPS, nginx, TLS, R2, Vercel |
| [docs/products/raqib.md](docs/products/raqib.md) | The Raqib product page: screenshots, lifecycles, highlights |
| [raqib/README.md](raqib/README.md) | Start here for Raqib: what is in the folder, how to run, test and deploy it |
| [raqib/docs/](raqib/docs) | Raqib's architecture, security model and operations guide |
| [raqib/docs/RAQIB_REQUIREMENTS_MATRIX.md](raqib/docs/RAQIB_REQUIREMENTS_MATRIX.md) | The client's 20 requirements against what works, with how each is tested |
| [raqib/docs/RAQIB_DELIVERY.md](raqib/docs/RAQIB_DELIVERY.md) | Costs, two-stage delivery, acceptance and handover |
| [docs/admit-deployment.md](docs/admit-deployment.md) | How Admit is deployed: VPS, nginx, TLS, Python worker, Vercel, backups |
| [docs/products/admit.md](docs/products/admit.md) | The Admit product page: screenshots, lifecycle, highlights |
| [admit/README.md](admit/README.md) | Start here for Admit: what is in the folder, how to run and test it |
| [admit/docs/](admit/docs) | Admit's audit of Core, architecture rules and known limitations |
| [SECURITY.md](SECURITY.md) | Security model and how to report a vulnerability |

## License

[MIT](LICENSE).
