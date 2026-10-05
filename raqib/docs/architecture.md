# Raqib — architecture, plan and decisions

Raqib is the fourth AURIC product (after Mizan, Atlas, HotelOS): security quality and field-inspection
management for a guarding company. The approved design is the Claude Design project `089bc4ff-…`
(`Raqib.dc.html` + `raqib-*.js`); it is the source of truth for the experience and is **not** redesigned.

## 1. Topology (mirrors `hotel-project/`)

```text
raqib/
├── backend/   Raqib API — NestJS on Fastify, AURIC Core by source (@core/*), Raqib domain (@raqib/*)
├── web/       React 19 + Vite + Tailwind 4 — the approved design, talks only to backend/ over HTTP
└── docs/
```

Backend = separate deployment (own process **:3300**, Postgres DB `raqib`, JWT secret, orgs/users). No npm
dependencies of its own — everything resolves from the repo root (one copy of Nest/Fastify/Kysely).
Boot: `main.ts → bootstrapAuricApp` (migrate → build → seed → listen). Composition: `app/app.module.ts`
(Core modules + `RaqibModule` + `DemoModule`). Migrations: hand-written SQL in `prisma/migrations/`
(Core baseline copied verbatim) + `prisma/schema/raqib-*.prisma` only to generate Kysely types.
Every tenant table: `organization_id` + FORCE RLS + `tenant_isolation` policy (a test asserts it for every table).

## 2. What belongs where

| Layer | Owns |
|---|---|
| **Core** (unchanged, imported by source) | identity/JWT/argon2, organizations (tenant), RBAC primitives, audit trail, files (presign → PUT → confirm, local + R2), events/outbox, notifications engine, http bootstrap/guards/zod pipes, config, request context |
| **`app/raqib`** | everything Raqib: projects/sites, assignments & scope, visits, forms/versions, inspections, answers, scoring, guard evaluations, workflow & decisions, observations, corrective actions, training, evidence linking, reports/PDF, analytics, search, notifications content, confidential system, onboarding (account requests) |
| **`web/`** | presentation + view-models + a typed HTTP client. No business rules, no authorization truth |

## 3. Domain model (tables, all `raqib_*`)

`projects → sites → areas`; `visits (project, site, inspector, type, shift, scheduled_at, status)` → one
`inspections` row per started visit. **Historical integrity:** starting an inspection snapshots the
published `form_version` into `inspection_items` (text, weight, type, rules, section) — answers reference the
snapshot rows, so later form edits can never move a past inspection. `form_versions` are immutable once
published; drafts are the only editable state. Decisions (`inspection_decisions`) store actor id **and**
name/role/title snapshots, previous/new state, reason, time. Project assignments are dated rows
(`project_assignments`: user, project, from, to) so past scope is reconstructable. Reports freeze a JSON
snapshot + the generated PDF (Core file) so a historical report is reproducible.

Other tables: `guard_evaluations(+scores)`, `observations`, `corrective_actions(+log)`, `evidence`
(business context link to a Core file), `training_requests(+history)`, `account_requests`,
`role_templates` (per-org role × module × action matrix — the editable Permission Templates screen),
`org_settings`, `report_jobs`, `visit_events`; confidential system in separate tables (§6).

## 4. Authorization (backend is the boundary)

Roles `qm, qe, pm, ins, gs, guard, gm` are seeded into Core RBAC (assignment per tenant). Capability checks
go through a Raqib access service: **role template (per-org, editable, audited) → project scope
(`project_assignments`) → object rule** (inspector only own visits; PM only own projects; guard only own
submissions). Every endpoint declares module+action and the service re-checks object scope, so changing an
id in a URL is rejected (404/403, tested). Core permissions are still used for the generic infrastructure
(files, audit read). Search, analytics, reports, exports and file access all run through the same scope filter.

## 5. Inspection engine

Pure domain modules (unit-tested, no I/O): `workflow` (state machine: scheduled → assigned → in_progress →
pending_review → pending_approval → approved; returned ↔ in_progress; rejected; cancelled; overdue derived/
job), `scoring` (`ScoringPolicy` interface; `WeightedComplianceV1` = Σ compliant weights ÷ Σ applicable
weights, N/A excluded; replaceable without touching inspections), `form-diff`. Each transition runs in one
transaction: row lock → validate → history/decision → audit → outbox event → notification fan-out.
Reasons are mandatory for return/reject. Review ≠ approval (separate permissions).

## 6. Confidential reports — separate boundary

Own tables (`raqib_conf_*`) with a stricter RLS policy; excluded from search/analytics/exports/general audit.
Access is an explicit **grant** (named person, level, scope, expiry) issued only by the General Manager role
(`grantAdmin`), never derivable from a role template. Entering the area requires a stated reason and writes
to a protected access log (read-only, visible to the GM). Reporter identity is stored separately and revealed
only with a reason (logged). Notifications carry no content. Evidence for confidential reports is
stored under a protected file purpose and served only through the same checks.

## 7. Evidence, reports, jobs

Evidence uses Core files (presign → direct PUT → confirm; Cloudflare R2 in production, local in dev); a Raqib
`evidence` row links file → visit/inspection/item/observation/CA/guard evaluation. Reads go through an
authorized endpoint that returns a short-lived signed URL (video: logged request). **PDF:** server-side HTML →
PDF with headless Chromium (`puppeteer-core`, binary path in config) because correct Arabic shaping/RTL needs a
real layout engine; the report HTML is rendered from the frozen snapshot, AR or EN. (Open decision: confirm
Chromium is acceptable on the client VPS; fallback is a bundled-font PDFKit renderer with reduced Arabic fidelity.)
Background jobs (Core worker lifecycle, like HotelOS `jobs`): overdue visits, overdue CAs, account-link expiry.
Analytics computes on request in SQL from stored scores (no stored dashboard numbers); demo history is seeded
through the real repositories with a deterministic RNG.

## 8. Frontend strategy (what changes vs. the interrupted mock approach)

The earlier plan of an in-browser mock adapter is **dropped**: the real backend replaces it. `web/` keeps the
design-faithful screens (transpiled once from the design file into `src/ui/generated`, now owned source) and the presenters
(view-model builders), now fed by TanStack Query hooks over `src/api` (typed client, token refresh via
`@auric/web`-style single-flight). Business logic that the design kept in the browser (transitions,
notifications, audit, analytics, report data, search) moves to the backend. Scenario/demo switcher stays,
using real demo accounts (`demo` password) and real data. Arabic/English and RTL are first-class (strings
`src/i18n`, locale formatting `src/lib/format`).

## 9. Phases (each ends green: typecheck, lint, unit, integration, migration, seed, authz tests)

1. **Foundation** — backend scaffold, Core baseline migrations, config, roles/permissions, org/user seed,
   projects/sites/assignments/scope, `/me`, access service, tests. Web: HTTP client, auth, shell.
2. Projects & scheduling — visits, assignment, lifecycle, calendar. 3. Inspection engine — forms/versions,
   snapshot, answers, scoring, drafts, guard evaluations, submit. 4. Review workflow — queue, return, reject,
   forward, approve, events, notifications. 5. Evidence & reports — uploads, authorization, PDF, history.
6. Quality ops — observations, CAs, training. 7. Analytics & search & exports. 8. Confidential system.
9. Hardening — audit review, rate limits, security tests, backup/restore doc, production config, deploy.

### Status

| Phase | State |
|---|---|
| 1 Foundation, 2 Projects & scheduling, 3 Inspection engine, 4 Review workflow | done (PRs #8–#11) |
| 5 Evidence & reports (frozen snapshots, real PDF, protected viewer) | done (#12) |
| 6 Quality ops (observations, corrective actions, training, guard records) | done (#13, #14) |
| 7 Analytics, CSV export, search | done (#15) |
| 8 Confidential area | done (#16) |
| 9 Hardening (rate limits, headers, audit log, authz review test, `docs/security.md`, `docs/operations.md`) | done |
| Account onboarding (public request + e-signature, review, approval creating the account, emailed password setup) | done |
| Product readiness: pagination, tenant provisioning CLI, account security (lock-out, TOTP, password policy, enforcement), upload safety, PDF queue, observability, data lifecycle, offline field inspections (PWA + outbox), native Excel export, browser end-to-end tests, CI | done; see `security.md`, `operations.md` and section 11 |

## 10. Decisions log

| # | Decision | Why |
|---|---|---|
| 1 | Backend at `raqib/backend`, port 3300, DB `raqib`, aliases `@core/*` `@raqib/*`, no own deps | Exactly the Atlas/HotelOS pattern |
| 2 | Hand-written SQL migrations + Prisma models for Kysely types | Prisma can't express RLS/CHECKs/partial indexes the schema needs |
| 3 | Editable permission templates are Raqib data, not Core roles | Core roles are global per deployment; a per-tenant editable matrix must not change other tenants |
| 4 | Inspection items are snapshotted from the form version at start | Historical integrity independent of form edits |
| 5 | User-entered text stored once (single language); master data (projects, sites, forms) may carry `name_ar`/`name_en` | Never auto-translate or duplicate user content |
| 6 | No mock adapter in `web/` | A real backend + demo seeder is the demo |
| 7 | Nothing is committed/pushed unless asked | Standing repo rule |
| 8 | Reports are frozen JSON snapshots issued inside the approval transaction; PDF is rendered from them on demand | Later edits must never change what was approved |
| 9 | Observations are recorded from approved inspections (violations) or reported directly; one corrective action per observation | Findings and the work to fix them stay separate and auditable |
| 10 | Analytics are pure functions over persisted data | Every number can be explained, drilled into and tested |
| 11 | Confidential access = explicit GM grant + logged session; identity stored apart; restrictive RLS | No role can open it; nothing about the reporter leaks through ordinary tables |
| 12 | In-process rate limiter | One process per deployment; documented limit |

## 11. Offline field inspections (web)

`web/src/services/offline/` (with `hooks/use-offline-sync.ts` and `components/SyncStatus.tsx`): an installable PWA (`public/sw.js` keeps the app shell, never API data, on the device) plus a per-user
IndexedDB store. Reads of the screens an inspector needs (projects, guards, visits, the open inspection) are remembered and served
when the network is down; edits to an inspection (answers, notes, guard scores, evidence, submit) are queued in an outbox and replayed
in order when the connection returns (`session.ts` probes `/api/health`; `outbox.ts` merges repeated edits and separates "try later"
from "refused for good"). Queued files are kept as bytes on the device. Starting a new inspection still needs a connection (the server
snapshots the form). Everything is scoped by user id; sign-out clears the cached copies and keeps only that person's unsent changes.
A real-browser test (`web/e2e`) drives this against the real backend: answer offline, reload with no network, reconnect, verify the
server. The web app's structure, layering rules and where to add things are in `web/README.md`; colors live only in
`web/src/styles/colors.ts`.
