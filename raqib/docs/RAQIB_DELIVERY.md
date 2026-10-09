# Raqib — delivery, costs and acceptance (requirement 20)

This document states what is delivered, what it costs to run, how it is accepted and what is handed over. **It contains no
invented prices and no invented durations**: wherever the client has not supplied a number, the line says so.

## 1. Budget

- Ceiling for the build: **USD 500** (the client's stated cap). No feature in this round needs a paid service.
- **Power BI and any external analytics subscription are not used.** Analytics (periods, project filters, trends, closure
  durations, recurring violations, training metrics, project ranking, CSV and Excel export) are computed by the Raqib backend
  from its own database and shown in the app.
- Anything the client later asks for beyond the 20 requirements is quoted separately and is not covered by this ceiling.

## 2. Recurring costs (identified, not priced)

These are the services the running system depends on. Their prices are set by each provider and change; none is stated here.

| Service | What it is for | Today | Notes |
|---|---|---|---|
| Server (VPS) | Runs the API and PostgreSQL | An existing VPS | Size to the number of users and stored files |
| Web hosting | Serves the web app | Vercel project `raqib-web` | A free tier has been used; usage limits are the provider's |
| File storage | Evidence photos/videos, attachments | Cloudflare R2 bucket `raqib-files` (or local disk on a single small server) | Cost follows stored volume; retention purge exists |
| Domain name | A proper address for the app | None yet (a free `sslip.io` hostname with Let's Encrypt is used) | Needed before a branded launch; yearly registration |
| E-mail (SMTP) | Escalations, high-severity alerts, account set-up | **Not configured** (`AURIC_SMTP_URL` unset; mail stops at the outbox) | Required for e-mail to actually reach people |
| Backups | Database dump and bucket copy | Scripts exist (`scripts/offsite-backup.mjs`); destination storage is a cost | See `operations.md` |

## 3. Two stages

Durations are **not** stated: they depend on when the client supplies the materials in §5 and are to be agreed with the client.

**Stage 1 — engine and rules.** Deliverables: scoring engine with versioned configuration; several forms per visit with issue
numbers; roles including Administrative Staff; corrections log; shifts and scheduling rules; escalation; training approval
chains; contract data, project ranking and permission-aware search; confidential surveys; branding settings.
*Acceptance:* the automated suites pass (backend, web, end-to-end) and each row marked Verified in
`RAQIB_REQUIREMENTS_MATRIX.md` can be reproduced by the client's reviewer with the demo organization.

**Stage 2 — content, output and polish.** Deliverables: the client's original forms loaded as form versions; the approved
deduction table, shift hours and escalation rules entered by the client's designated people; the client's name and logo; MOI and
quality standards if supplied; PDF and mobile review with real content; remaining UI refinements.
*Acceptance:* a walkthrough of the whole workflow with the client's real forms —
schedule → inspect (original forms, auto-populated data, auto-scored) → corrective action → review → approval → PDF → analytics —
on a phone and a desktop, in Arabic and English.

## 4. Handover

| Item | Where |
|---|---|
| Source code (backend, web, Core) | The project repository (`raqib/backend`, `raqib/web`, Core at the repo root) |
| Database | PostgreSQL schema created by the migrations in `raqib/backend/prisma/migrations`; a backup/restore procedure in `operations.md` |
| Admin set-up | `operations.md` (environment, first organization, roles); in the product: Settings (organization, scoring, shifts, escalation, training chain, ranking weights, branding), permissions and user management |
| User documentation | `architecture.md` (how it works), `security.md` (access and confidentiality model), the on-screen help and the Arabic walkthrough video tooling in the repository; a short per-role guide is the next document to write once the forms are final |
| Backup and restore | `operations.md` § backups; `scripts/offsite-backup.mjs` |
| Post-delivery bug-fix period | **Length not agreed.** To be set with the client; defects found against the matrix are fixed within it |
| Requirements-to-implementation report | `RAQIB_REQUIREMENTS_MATRIX.md` |

## 5. What the client still has to supply

1. The numbered requirements 1–14 (the matrix keeps provisional rows P1–P14 until then).
2. The original inspection forms and their versions.
3. The approved deduction table and the person who maintains it.
4. Shift names and hours; the consecutive-shift rule.
5. The escalation counting rule and recipients; what counts as high severity.
6. MOI requirements and quality standards to embed.
7. The organization's name and logo (the product is configurable until then: Settings → organization has the name and a logo upload control).
8. Ranking weights, if equal weights are not what the client wants.
9. Acceptance dates, stage durations, and the bug-fix period.

## 6. Demo

The demo organization (`RAQIB_ALLOW_DEMO_IN_PRODUCTION`) shows scheduling, multi-form inspections, scoring, corrective actions,
review and approval, PDFs, analytics with project ranking, and training requests. It also has an open and a draft survey and guard-origin training requests (the General Manager names the survey manager, as in real use). Because the client's original forms are not supplied, the demo forms are
placeholders.

Final acceptance depends on verification against the matrix with the client's real content; this document is not itself an
acceptance.
