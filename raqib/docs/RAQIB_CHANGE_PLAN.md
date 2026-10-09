# Raqib — change plan (client feedback round 1)

Companion: `RAQIB_REQUIREMENTS_MATRIX.md` (requirement → code → status). This round **enhances the existing app**; nothing
is rebuilt. Stack, auth, routing, design system, deployment and data are unchanged. All schema changes are additive
migrations (new tables/columns with defaults); no data is reset or dropped.

## 1. What exists today (audit summary)

- **Backend** `raqib/backend` — NestJS/Fastify on AURIC Core, Postgres + RLS on every tenant table, hand-written SQL migrations
  (`prisma/migrations`, latest `20261015120000_raqib_project_closed`), Kysely types in `app/raqib/db/schema.ts`.
  Modules under `app/raqib/*`: access (template → scope → object rule), projects, visits, forms, inspections, review, reports,
  observations, actions, training, analytics, confidential, onboarding, settings, audit, search, evidence, jobs.
- **Web** `raqib/web` — React 19 + Vite + Tailwind 4; approved-design screens in `src/ui/generated/screens`, view-model
  presenters in `src/presenters`, TanStack Query hooks, AR/EN strings in `src/i18n`, offline outbox for inspectors.
- **Tests** — backend: unit + integration suites against a throwaway Postgres (`raqib_test`); web: Vitest (52) + Playwright e2e.
- **Not present** — deduction scoring, Administrative Staff role, configurable shifts, 3/6/9-day escalation, several forms per
  visit, blank-form printables, a correction record for system fields.

## 2. Hard constraints on this round

1. The client's **original inspection forms**, **deduction values**, **shift times**, **consecutive-shift rule**, **escalation
   counting rule and recipients**, and **MOI requirements** were not supplied. They are modelled as *configuration*, left
   empty or marked "assumed – confirm", and never silently invented. See §6.
2. Budget cap $500: no new paid service. PDFs stay browser-generated (no server browser) unless a free, dependency-light path is found.
3. Existing behaviour stays: where a new rule has no configuration yet, the old behaviour applies.

## 3. Implementation order (dependency order)

| Step | Phase | Change (status at the end of this round) | Why first |
|---|---|---|---|
| 1 | B/C | **Scoring** — DONE: pure deduction policy (`deduction_v1`), versioned immutable `raqib_scoring_configs`, per-inspection config pin, `raqib_inspection_deductions` unique per (inspection, item), floor 0; designated scoring editor (`raqib_designations`) | Everything downstream (reports, analytics, PDF) reads the score |
| 2 | A/C | **Score visibility** — DONE: server strips scores/analytics from inspectors; web hides the tiles | Isolation requirement, small |
| 3 | C | **Administrative Staff** — DONE role; "Security Supervisor" naming for `gs`; template defaults | Needed before schedule/permission work |
| 4 | C | **Corrections log** — DONE `raqib_corrections` (field, previous, new, user, role, time, reason), append-only | Required by "authorised corrections" |
| 5 | D | **Shifts as configuration** — DONE (values blocked) + 12-hour display + conflict/consecutive rule engine (rule empty until client confirms) | Scheduling |
| 6 | B | **Several forms per visit** — DONE + inspection issue numbers (`INS-yy-nnnn`) | Largest change; after scoring so each form scores independently |
| 7 | E | **Escalation 3/6/9** — DONE (rule blocked) (+ immediate high-severity), levels/recipients/counting in settings, email channel, history entries, job | Observations lifecycle |
| 8 | G | **PDF** — DONE (browser-made, inspected): blank-form printable, page numbers, repeating table heads, deductions & signatures in the report | After scoring/forms exist |
| 9 | G | **Analytics** — DONE: closure durations, recurring violations, training metrics, ranking | Reads the new data |
| 10 | A/H | **UI** — PARTIAL (targeted, not a redesign): inspector journey cleanup, score hiding, month/year schedule views, RTL checks | Last, on top of the new API |

## 4. Acceptance criteria (per step, all must be automated unless stated)

1. A configured deduction policy yields `100 − Σ deductions`, never below 0; the same violation can never deduct twice; an
   inspection issued under config *v1* keeps *v1* after *v2* is published; only the designated user can publish a config; with no
   config the previous policy is used.
2. An inspector's API responses for inspections/visits contain no score; the web renders no score for them.
3. An `adm` user exists in the permission matrix with no inspection-review rights; role list is consistent across API and web.
4. A correction without a reason is rejected; every correction stores previous and new value; corrections cannot be edited or deleted.
5. Shifts come from settings; a schedule that violates a configured consecutive-shift rule is rejected with 409; with no rule nothing changes.
6. A visit can require N forms; submission needs all N complete; each has its own issue number and score; old single-form visits still work.
7. An action unresolved at 3, 6 and 9 days (counted per the configured rule) produces exactly one escalation per level to the configured recipients (in-app + email), recorded in its history; a high-severity observation notifies immediately.
8. A blank form and a completed report render as A4 with page numbers and repeated table headings in both languages (inspected visually).
9. Analytics expose closure duration, recurring violations, training metrics and project ranking from persisted data, scope-filtered.

## 5. Verification plan

Per step: `tsc`, backend Vitest (new focused tests + whole suite), web Vitest, then a manual run of the
end-to-end journey (schedule → inspect → score → review → action → verify → approve → PDF → dashboard) against the local
stack. Final numbers go into the matrix "Result" section.

## 6. Missing client-provided materials (blocking real content, not code)

1. The original inspection forms (names, numbers, item order, observation points) and any versions.
2. The approved **deduction table** (per item / per severity / caps) and who the designated scoring editor is.
3. Shift names and times, scheduling exceptions, the consecutive-shift rule.
4. Escalation **counting rule** (calendar vs working days; from assignment or from due date) and recipients for the 3/6/9-day levels, and what counts as "high severity".
5. MOI requirements and quality requirements to embed.
6. The original numbered client message (to re-map R1–R20).

## 7. Two-stage delivery (proposal – not agreed with the client)

- **Stage 1 (engine and rules):** steps 1–7 above plus the documents; acceptance = criteria 1–7 pass in CI.
- **Stage 2 (output and polish):** steps 8–10, client forms loaded, deduction table and shifts entered by the client's designated users; acceptance = criteria 8–9 and a walkthrough of the end-to-end journey with the client's real forms.
No dates or extra costs are implied here.

## 8. Outcome of this round

Steps 1–9 are implemented and covered by automated tests; step 10 is targeted improvement only. See the matrix for the status of each
requirement, and the end-of-work report for the final test numbers. Items still needing the client: §6. Items deliberately left:
structured survey designer, server-side PDF generation, a dedicated Quality Supervisor role, real SMTP verification, and a full visual
redesign of the approved screens.

## 9. Addendum: requirements 15–20 (received after the first plan)

The client's numbering is now known for **R15–R20**. The earlier rows R1–R14 in the matrix were derived by us from the first brief and are
renamed **P1–P14** (provisional) until the client's own numbers 1–14 arrive. Everything is in one matrix: `RAQIB_REQUIREMENTS_MATRIX.md`.

| R | Subject | Already in the app (audited) | To add | Depends on |
|---|---|---|---|---|
| 15 | Project ranking, contracts, permission-aware search | Search across scoped lists (no national ID, no inspection issue number); ranking by average score only; projects have no contract data | Contract start/end and employees assigned on the project; ranking by observations, improvement, complaints, contract proximity; search by national ID and inspection issue number; complaint counts only for people with a confidential grant | R17 (complaint source and its confidentiality), project records, analytics scope |
| 16 | Training request workflows | One chain (supervisor asks, project manager approves, quality schedules); full history | Guard-originated chain (supervisor review, then project manager, then quality); guard role may ask for itself; chain configurable in settings | Roles (P8), employee records, notifications |
| 17 | Surveys and confidential reports | Confidential area (grants, sessions, restrictive RLS, no-content notifications); a `survey` kind from round 1 | Real surveys: definitions managed by a named person, guards answer through the confidential pipeline; complaint-to-project link for indicators; a boundary test across search, analytics, exports, notifications, API and direct URLs | Designations (round 1), R15 indicators |
| 18 | Localization, configuration, versioning | Arabic/English and RTL; form builder and versions; scoring versions; employees and projects managed in the product; frozen reports | Branding (name and logo) configurable; spelling/language attributes on text inputs; quality standards and MOI requirements stay **blocked** until supplied | Settings, report print kit |
| 19 | Quality department responsibility model | Quality roles have no "work" right on corrective actions; the project manager owns remediation, quality verifies | Make it explicit and tested (who can be assigned, who closes, who approves training); document the difference between reporting lines and permissions | R16 chain |
| 20 | Delivery, costs, acceptance | Change plan and matrix; browser tests | `RAQIB_DELIVERY.md`: budget ceiling, recurring-cost services (no invented prices), two stages with deliverables/acceptance (durations left for the client to agree), handover list; branding config; updated demo showing the whole workflow | All of the above |

**Order (by dependency):** (1) migration for contract data, training stages, surveys and complaint link → (2) R16 workflow (self-contained, needed by R19 test) → (3) R17 surveys and complaint link → (4) R15 contracts, search, ranking (needs R17 counts) → (5) R19 tests → (6) R18 branding and input attributes → (7) R20 documents and demo → (8) matrix and acceptance run.

Assumptions, flagged: the guard-chain stages and who may skip them are configuration with the stated defaults; the ranking uses the four named indicators with equal weights until the client sets them; complaint indicators are shown only to people who already hold a confidential grant, so the existence of complaints is never visible to others.

### Status of the addendum

Steps 1-5 and 7 are implemented in the backend and covered by tests; the web side of R15 (contract fields, indicator line), R16
(supervisor stage, guard self-request) and R17 (survey panel) is built. Still open: a logo-upload control and a ranking sort/weights
screen in the web, e2e coverage for the new screens, and a demo seed with a survey and a guard-origin training request. The matrix
is the authority on each requirement's status.
