# Raqib — requirements matrix (one consolidated list, 20 requirements)

> **Numbering.** The client's own text is known for **R15–R20** (the scope-completion addendum). Requirements **1–14** were
> never supplied as a numbered list; the rows **P1–P14** below were derived from the first brief's themes (phases A–H) and are
> **provisional**: re-map them when the client's own 1–14 arrive. Nothing was invented as a client value; every missing value
> is listed in `RAQIB_CHANGE_PLAN.md` §6 and in "Blocked" below.

Statuses: **Verified** (works and is covered by a passing automated test), **Partial**, **Missing**, **Blocked** (needs a client
decision or asset). Where the *mechanism* is verified but the client's *values* are missing, both are said.

## A. Requirements 15–20 (client's numbering)

| # | Requirement | Where it lives | Status | Tests |
|---|---|---|---|---|
| R15 | Project ranking by observations, improvement, complaints and contract-expiry proximity; contract start/end and employees assigned; search by name, national ID, employee number, observation ref, inspection issue number, project code, permission-aware; complaint indicators without exposing confidential detail | Migration `20261017120000_raqib_addendum` (contract dates, `employees_assigned`, checks); `analytics/domain/project-ranking.ts` (percentile "attention" score, weights in `settings.ranking.weights`, single-indicator sorts via `?sort=`); `search-service.ts` (national ID exact match, issue number); complaint counts come from `ConfidentialService.complaintCounts(who)` and are `null` (not zero) without an active confidential grant. Web: contract fields on the project dialogs, indicator line on the analytics ranking | **Verified** (backend, web compiles and is lint/unit clean). Web: a rank-order selector on the analytics filters (attention, observations, improvement, complaints, contract, score); weights are edited in Settings → Project ranking (e2e `08g`) | `ranking-search.integration` (11), `project-ranking.test`, `analytics.test` |
| R16 | Training workflows: supervisor → PM → QM; guard → supervisor review → PM → QM; configurable; reason, priority, employee info, approval history, rejection reasons, execution status, timestamps, auto-populated data | `training/domain/training-state.ts` (statuses `pending_supervisor` → `pending_pm` → `approved` → `scheduled` → `completed`, plus `returned`/`rejected`), `requester_kind`, `settings.training.guardReviewBySupervisor` (off = guard requests go straight to the PM), guard role asks only for itself and sees only its own requests, history log with reasons, events and notifications per stage. Web: supervisor-review stage, "requested by", guard nav + self-request, settings switch | **Verified** | `training-chain.integration` (7), `training-state.test` |
| R17 | Surveys and confidential channel for guards; explicit allow-list; QM does not get access automatically; no leakage through search, dashboards, analytics, exports, e-mail, API or direct URL; enforced in backend and DB; confidential permissions separate from admin/quality | Existing confidential area (separate tables, restrictive RLS, grants + logged session, content-free notifications). New `surveys` module: definitions managed by people the GM **names** (`survey_manager` designation, separate from every template and from confidential grants); a guard's answer is filed as a confidential report (`survey_id`), the survey module keeps no copy and no route returns answers. Web: survey panel (answer with named / hidden / anonymous identity, create, publish, close, GM names managers) | **Verified** (backend boundary); web survey screen (`/surveys`, open to every role) covered by e2e `08e-surveys` | `surveys.integration` (8), `confidential.integration`, `responsibility-model.integration` |
| R18 | Arabic/English throughout; RTL/LTR; spelling support; manage projects, employees, forms, items, weights, authorised people; historical versions; issued reports keep their configuration; MOI/quality standards only when supplied | AR/EN string tables for every new screen; form versions, scoring config versions, report snapshots (now also freeze branding); `BrandingService` + `settings.org.logo` (name and logo on blank forms, reports, schedule); `lang`/`spellCheck` on the survey text boxes | **Partial.** Branding: **Verified** (backend test) and a logo upload control in Settings → organization. Spell-check and language attributes are on the survey inputs, on dialog text areas and on Arabic text boxes; not audited on every screen. MOI/quality standards: **Blocked** (not supplied) | `branding.integration` (4), `report-snapshot`, existing form/scoring version tests |
| R19 | Quality department responsibility model: quality inspects, oversees, verifies, follows up; PM and operations own corrective actions; reporting line ≠ permission | Permission templates: no "work" letter on actions for quality roles; QM keeps training "VERX" (no PM-stage approve); written down in `security.md` | **Verified** | `responsibility-model.integration` (4) |
| R20 | Delivery, cost and acceptance: client asks ≤ $500 (price to be agreed; the scope exceeds it), no Power BI / external analytics subscription, recurring costs identified without invented prices, two stages with deliverables/acceptance, handover list, configurable branding, requirements-to-implementation report, updated demo, acceptance by verification | `docs/RAQIB_DELIVERY.md`; this matrix is the requirements-to-implementation report; analytics are built in (no external subscription) | **Partial.** Document **done**; durations and prices are deliberately **left for the client** (none invented); the demo seed now includes an open and a draft survey and two guard-origin training requests (one awaiting the supervisor, one reviewed); the General Manager still names the survey manager | — |

## B. Provisional requirements P1–P14 (derived from the first brief)

| # | Requirement (from the brief) | Where it lives now | Status | How it is tested |
|---|---|---|---|---|
| P1 | UI/UX: less crowded, consistent, responsive, RTL/LTR; inspector journey My Visits → Visit → Form → Evaluation → Evidence → Submission | Approved design screens; score hidden from inspectors, 12-hour times, form switcher and "print blank form", month view and period navigation, analytics blocks, settings tabs | **Partial** (targeted improvements, not a redesign: rule "keep the design system") | e2e `11-client-feedback-1` |
| P2 | Original client forms preserved | Forms are data with versions; the demo forms are placeholders | **Blocked** (client forms not provided) | — |
| P3 | Several forms within a single visit | `raqib_visit_forms`, inspection per (visit, form) | **Verified** | `multi-form.integration`, `journey.integration` |
| P4 | Form versioning without changing history | Immutable published versions, item snapshot at start | **Verified** | `inspections.integration`, DB triggers |
| P5 | Compliant / Non-compliant / N/A, notes, image and video evidence | Answers `c/n/x`, note, severity, evidence module | **Verified** | `inspections.integration`, `evidence-safety.integration` |
| P6 | Auto-populated data; unique issue and observation numbers; automatic timestamps | Visit supplies project/site/area/shift/inspector/date; `INS-`, `OBS-`, `CA-`, `VIS-`, `RPT-` counters; server-written times | **Verified** | `multi-form.integration`, `journey.integration` |
| P7 | Score from 100 with approved deductions; no duplicate deduction; floor 0; rules at issue time preserved; config restricted to the designated user | `deduction_v1`, `raqib_scoring_configs`, `raqib_inspection_deductions`, `raqib_designations` | **Verified (engine) · Blocked (values: no deduction table supplied)** | `deduction-policy.test`, `scoring.integration` |
| P8 | Roles incl. Administrative Staff, Security Supervisor, Quality Inspector, confidential personnel | `adm` role; naming of `gs`/`ins`; confidential access is a GM grant | **Verified** (the `adm` template is an assumption) | `admin-role.integration`, e2e role tour |
| P9 | Backend-enforced permissions, isolation; search/exports/URLs cannot bypass | Template → scope → object rule; every route declares a permission (static test) | **Verified** | `foundation`, `hardening`, `journey` |
| P10 | Inspectors cannot alter system data; authorised corrections are logged | `raqib_corrections` (append-only) | **Verified** | `scoring.integration`, `journey.integration` |
| P11 | Annual / monthly / weekly scheduling, conflict prevention, filters, print, export | List, week, month views; CSV and A4 print; guards on shift chosen in the schedule dialog; a visit starts on its scheduled day unless `settings.insp.allowEarlyStart` is on | **Verified** | `scheduling-rules.integration`, e2e |
| P12 | Configurable shifts, 12-hour display, consecutive-shift rule | `settings.schedule`, `schedule-rules.ts` | **Verified (mechanism) · Blocked (values)** | `schedule-rules.test`, `scheduling-rules.integration` |
| P13 | Observation → classification → assignment → action → evidence → verification → closure; history | Existing lifecycle plus form/issue number, elapsed days, escalation level | **Verified** | `quality.integration`, `journey.integration` |
| P14 | Escalation at 3/6/9 days with e-mail; immediate high-severity notice | `settings.escalation`, `RaqibJobs.escalateActions` | **Verified (mechanism) · Blocked (counting rule and recipients are assumptions)** | `escalation.test`, `escalation.integration` |

## C. Foundations carried over (earlier derived rows, unchanged)

| # | Requirement | Status | Tests |
|---|---|---|---|
| F1 | Review / approve / reject / return with reasons and decision trail | **Verified** | `review.integration`, `journey.integration` |
| F2 | Employee (guard) evaluation | **Verified** | `guards-management.integration` |
| F3 | Account undertaking and activation workflow | **Verified** | `onboarding.integration`, `signup-closed.integration` |
| F4 | Real A4 PDFs per form: blank, completed, final; RTL; page numbers; repeating headings | **Verified** (browser print, inspected). Server-side PDF generation is **not** provided (decision: no browser on the server) | `print-render.test`, `journey.integration` |
| F5 | Reports and analytics: periods, filters, trends, closure durations, recurring violations, training metrics | **Verified** | `analytics.test`, `analytics.integration` |
| F6 | Confidential reports with allow-listed access | **Verified** (extended by R17) | `confidential.integration` |

## What is not done, and why

- **Blocked on the client:** original forms (P2), deduction table (P7), shift hours and rule (P12), escalation counting rule and
  recipients (P14), MOI and quality standards (R18), the client's own numbered 1–14, the name and logo, durations and any prices.
- **Not built:** server-side PDFs; a dedicated Quality Supervisor role; real SMTP verification (checked up to
  Core's outbox only); a full visual redesign of the approved screens.

## Results

Final run, 2026-10-09 (after the browser walk-through fixes, the start-on-the-day rule and the answer rules):

| Suite | Result |
|---|---|
| `raqib/backend` `tsc`, ESLint, Prettier | pass (0 lint errors; 4 older warnings in test files) |
| `raqib/backend` Vitest (Postgres `raqib_test`) | **373 tests / 48 files, all pass** |
| `raqib/web` `tsc -b`, ESLint, Prettier | pass (0 errors; 5 older landing-page warnings) |
| `raqib/web` Vitest | **58 tests / 12 files, all pass** (includes the check that every string key exists) |
| `raqib/web` Playwright (real Chrome, real backend) | **57 tests: 56 passed, 1 skipped (pre-existing), 0 failed** (includes surveys, the guard training chain, ranking weights) |
| Live deployment, read-only (`e2e/90-live-smoke.spec.ts`) | **8 / 8 passed** against `raqib-web.vercel.app` and the live API: every role opens its screens without errors, key figures read correctly, a project manager is refused the confidential reports, Arabic on a phone is right-to-left with no sideways scroll |
| Full workflow by hand in Chrome | schedule (two forms, guards) → inspect → review → approve and issue → observation → corrective action → verify and close, including the early-start refusal and the note/evidence rule |
