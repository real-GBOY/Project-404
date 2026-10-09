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
| **`app/raqib`** | everything Raqib: projects/sites, assignments & scope, visits, forms/versions, inspections, answers, deduction scoring, corrections, guard evaluations, workflow & decisions, observations, corrective actions, training (approval chains), evidence linking, reports/PDF, analytics and project ranking, search, notifications content, confidential system and surveys, onboarding (account requests), settings, demo seeding |
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

**Set-up flow (projects, sites, areas, guards).** A tenant is stood up entirely from the product: create a project, add its
sites and areas (rename or archive them later; archived ones keep their history but take no new visits), then add guards to
the roster. All of it needs the `projects` **E** right (creating a project needs **A**) and the caller's project scope. A guard
has a fixed employee number (history is keyed on it), a 10-digit national ID stored sealed and shown masked (never written
to the audit trail), and may be linked to one guard-role sign-in account so they can use the confidential area. Taking a guard
off the roster only blocks new evaluations; their records stay. The web does this through data-entry dialogs
(`presenters/modals/forms.ts` field specs, `handlers/projects.ts`, `components/ModalForm.tsx`).

**Upkeep flows.** A project that has ended is set to `closed`: it stays in history and reports but takes no new visits (409
`raqib.project_closed`). A person's name, title, phone and employee number are corrected with `PATCH /users/:id` (role, scope and
status keep their own routes); an administrator can reset a lost second factor and export a person's data from their page. A
stuck corrective action is moved to another eligible person and/or a later due date with `POST /actions/:id/reassign` (reason
required, closed actions are immutable, the new person is notified, the overdue warning can fire again). Inspection forms are
created with a real code and name and can be renamed, and field observations can be raised outside an inspection. Visits take an
area from the site's list, or free text for an area that is not registered.

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
authorized endpoint that returns a short-lived signed URL (video: logged request). **PDF:** made in the browser. The server builds the report as one self-contained, print-ready HTML page from the frozen snapshot (AR or EN, evidence
photos inlined) at `GET /reports/:id/html`; the web app loads it into a hidden frame and calls print ("Save as PDF"), where the browser's own layout
engine gives correct Arabic shaping and RTL. (An earlier design rendered PDFs on the server with headless Chromium; that was dropped: it needs a
browser on the server, and the client already has the best engine.)
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
| Product readiness: pagination, tenant provisioning CLI, account security (lock-out, TOTP, password policy, enforcement), upload safety, observability, data lifecycle, offline field inspections (PWA + outbox), native Excel export, browser end-to-end tests, CI | done; see `security.md`, `operations.md` and section 11 |

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
| 8 | Reports are frozen JSON snapshots issued inside the approval transaction; the printable page is built from them on demand | Later edits must never change what was approved |
| 9 | Observations are recorded from approved inspections (violations) or reported directly; one corrective action per observation | Findings and the work to fix them stay separate and auditable |
| 10 | Analytics are pure functions over persisted data | Every number can be explained, drilled into and tested |
| 11 | Confidential access = explicit GM grant + logged session; identity stored apart; restrictive RLS | No role can open it; nothing about the reporter leaks through ordinary tables |
| 12 | In-process rate limiter | One process per deployment; documented limit |

## 12. Client feedback round 1 (2026-10)

The change plan and the requirement-by-requirement status are in [RAQIB_CHANGE_PLAN.md](RAQIB_CHANGE_PLAN.md) and
[RAQIB_REQUIREMENTS_MATRIX.md](RAQIB_REQUIREMENTS_MATRIX.md). What this round added to the architecture (all additive migrations
`20261016120000` … `20261016120500`; nothing existing was rewritten):

| Area | What it is |
|---|---|
| **Deduction scoring** (`app/raqib/scoring`, `inspections/domain/scoring.ts`) | `deduction_v1` policy: base 100 minus a configured amount per non-compliant item (item amount beats severity amount), never below 0, one deduction per recorded violation (`raqib_inspection_deductions` primary key). Rules are versioned, immutable rows in `raqib_scoring_configs`; an inspection pins the version when it starts, so a later publish never moves it. With **no** configuration the earlier `weighted_compliance_v1` keeps scoring. Only a person the General Manager names (`raqib_designations`) may publish, which is deliberately not a permission-template right. |
| **Score visibility** (`access.canSeeScore`) | Inspections and visits return no percentage, deductions or rule version to a role that cannot review, approve, read reports or read analytics (the inspector). Enforced in the API, not just the screens. |
| **Several forms per visit** (`raqib_visit_forms`, `raqib_inspections.form_id/issue_no`) | A visit names the forms it needs; each form is its own inspection with its own issue number (`INS-yy-nnnn`) and score, started separately and submitted together. The guard evaluation belongs to the first form. Review flags items against the inspection that owns them; approval records violations for every form and the report carries each form (`extraForms`). A visit that names none uses the default site form exactly as before. The visit-level figure is the **mean** of its forms (assumption, flagged for the client). |
| **Shifts and scheduling rules** (`settings.schedule`, `visits/domain/schedule-rules.ts`) | Shifts are configuration (key, names, optional hours). Two rules, both **off by default**: minimum rest hours between an inspector's shifts and a cap on consecutive days. The backend rejects a violating assignment with 409. A shift in use cannot be removed. |
| **Escalation** (`settings.escalation`, `actions/domain/escalation.ts`, `RaqibJobs.escalateActions`) | An action still with its responsible person escalates at each configured day threshold (3, 6, 9 by default). Counting (from assignment or due date, weekend days that do not count) and recipients per level are settings. Each level is announced once (`escalation_level` on the action), written into the action history as an `escalated` event and sent in-app and by email. A high-severity observation notifies the configured roles at once. |
| **Corrections** (`raqib_corrections`) | The only way system-generated inspection data (start/submit times, a deduction amount) changes after the fact: previous value, new value, who, role, when and why, append-only. Times need the approve right; deductions need the scoring designation. |
| **Administrative Staff** (`adm`) | New role: schedules and prints visits in assigned projects; no inspections, review, scores, analytics, users or settings by default. |
| **Printable documents** (`reports/domain/print-kit.ts`, `report-html.ts`, `forms/domain/blank-form-html.ts`) | One A4 stylesheet for completed reports and blank forms: page numbers, repeated table headings, rows that never split, long text that wraps, bidi-safe numbers, deductions and signature lines; blank forms at `GET /raqib/forms/:id/blank`. The browser still produces the PDF. |
| **Analytics** | Added closure durations, recurring violations, observation summary, training metrics and project ranking, all computed from persisted rows and scope-filtered, in the CSV/Excel export too. |

Decisions added:

| # | Decision | Why |
|---|---|---|
| 13 | Client-supplied values (deductions, shift hours, rest/consecutive rules, escalation rule) are configuration that ships empty or flagged as assumed | The client's values were not provided; inventing them would put wrong numbers in front of auditors |
| 14 | Scoring configuration changes are not a template right but a named designation | "Restricted to the client-designated user" must hold even for people with full settings access |
| 15 | One inspection per (visit, form), one report per visit | Each form needs its own number and score; the approval decision is about the visit |
| 16 | Services use the injected clock, not `new Date()` | Escalation and analytics are time-driven and must be testable; corrective actions had the last stray `new Date()` |

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

## 13. Addendum: requirements 15-20

- **Projects** carry `contract_start`, `contract_end` and `employees_assigned` (additive migration `20261017120000_raqib_addendum`).
- **Ranking** (`analytics/domain/project-ranking.ts`) is pure: the service gathers observations, improvement, complaint counts and
  days to contract end; each indicator becomes a percentile and the weighted mean (weights in `settings.ranking.weights`) is the
  "attention" score. Any single indicator can be the sort instead.
- **Search** adds an exact national-ID match and the inspection issue number, always through the caller's scope.
- **Training** is a state machine `pending_supervisor` (guard requests, when `settings.training.guardReviewBySupervisor`) →
  `pending_pm` → `approved` → `scheduled` → `completed`, with `returned` and `rejected` and a history entry per step.
- **Surveys** (`app/raqib/surveys`): definitions only; answers are filed through `ConfidentialService.submit` with a `survey_id`.
- **Branding** (`shared/branding.ts`): organization name and logo from settings, printed on blank forms, the schedule and reports,
  and frozen into a report's snapshot when it is issued.
- **Report page and review screen** show every form of a visit (the snapshot's `extraForms`), and under deduction scoring show what each violation cost instead of the old item weights and section percentages. The review queue's violation and evidence counts come from `VisitsRepository.findingCounts`.
- **Visit rules**: guards on shift are chosen when scheduling (they must belong to the project); an inspector starts a visit on its scheduled day unless `settings.insp.allowEarlyStart` is on (off by default; the demo organization turns it on).
- **Answer rules**: a non-compliant answer with no chosen severity is stored as Medium, matching what the screen shows, so it always deducts; moving an item away from non-compliant drops its note and is refused while its evidence is still attached (`raqib.remove_evidence_first`), so a violation photo never sits under a compliant item and nothing is deleted automatically. A refused change reverts on screen with the reason.
- **Demo data tooling** (`demo/demo-seeder.ts`): `RAQIB_DEMO_SAMPLE_VALUES=true` seeds clearly labelled placeholder deduction values, shift hours and a consecutive-day limit; `npm run demo:upgrade` (`upgradeExisting` + `verifyDemo`) adds what an already seeded demo lacks without a reset and runs read-only consistency checks. Training history rows are immutable by trigger, so the seeder stamps them with a pinned business date rather than editing them afterwards.
