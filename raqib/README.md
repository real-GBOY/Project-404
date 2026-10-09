# Raqib

Security quality and field-inspection management for a security-guarding company: scheduled site visits, versioned checklists (several per
visit), review and approval, corrective actions with escalation, guard evaluation and training, project ranking and analytics, a confidential
channel with surveys, and printable Arabic and English reports. Built on Project-404 **Core**, in Arabic and English with full right-to-left
support.

Product page (screenshots, roles, lifecycles, numbers): [docs/products/raqib.md](../docs/products/raqib.md).

## What is in this folder

| Path | What it is |
|---|---|
| [`backend/`](backend) | NestJS API on Core, its own database `raqib`, port 3300. Domain code in `backend/app/raqib/*`, hand-written SQL migrations in `backend/prisma/migrations/` |
| [`web/`](web) | React 19 + Vite + Tailwind 4 app, port 4500, installable and offline-capable. See [`web/README.md`](web/README.md) |
| [`docs/`](docs) | Architecture, security and operations, plus the client requirement documents (below) |

## Run it locally

```bash
cd raqib/backend
cp .env.example .env              # RAQIB_SEED_DEMO=true seeds the demo company
createdb raqib
npm run migrate && npm run dev    # migrates, seeds, serves :3300 (API docs at /api/docs)
cd ../web && npm install && npm run dev      # http://localhost:4500
```

Every demo account uses the password `demo-password-2026` (the list is on the sign-in page and in
[the product page](../docs/products/raqib.md#demo-accounts)).

The client's own values (deduction table, shift hours, rest rules) are not known yet. To show the whole workflow with **placeholder** values, start
the server as `RAQIB_DEMO_SAMPLE_VALUES=true npm run dev` (command line, not `.env`: the tests read `.env` too).

## Useful commands (in `raqib/backend` unless noted)

| Command | What it does |
|---|---|
| `npm run ci` | typecheck, lint, format check, all backend tests, production build |
| `npm run migrate` / `migrate:status` | apply or show migrations |
| `npm run provision -- --name … --slug … --owner-email …` | create a real customer organization (no demo data) |
| `npm run demo:upgrade` (`-- --check` to only check) | bring an already seeded demo up to date without a reset, then check consistency. Adds only what is missing; never re-scores issued work |
| `npm run build` | compile to `dist/`; `scripts/deploy-raqib-local.sh` (repo root) ships it |
| `cd ../web && npm run typecheck && npm run lint && npm test` | web checks |
| `cd ../web && npm run e2e` | browser tests in real Chrome on a throw-away database |

Test counts and what each suite covers are on the [product page](../docs/products/raqib.md#tests).

## Documentation

| Document | For |
|---|---|
| [docs/architecture.md](docs/architecture.md) | How it is built, the domain model, decisions, what each client round added |
| [docs/security.md](docs/security.md) | The security model: authorization, the confidential boundary, encryption, uploads |
| [docs/operations.md](docs/operations.md) | Configuration, backups, retention, file storage, checking a live deployment |
| [../docs/raqib-deployment.md](../docs/raqib-deployment.md) | How the live system is deployed (VPS, nginx, TLS, R2, Vercel) |
| [docs/RAQIB_REQUIREMENTS_MATRIX.md](docs/RAQIB_REQUIREMENTS_MATRIX.md) | The client's 20 requirements against what works, how each is tested, and what is blocked |
| [docs/RAQIB_CHANGE_PLAN.md](docs/RAQIB_CHANGE_PLAN.md) | The plan and order of the client-feedback work |
| [docs/RAQIB_DELIVERY.md](docs/RAQIB_DELIVERY.md) | Costs (without invented prices), two-stage delivery, acceptance, handover |
| [docs/RAQIB_CLIENT_CHECKLIST_EN.md](docs/RAQIB_CLIENT_CHECKLIST_EN.md) · [AR](docs/RAQIB_CLIENT_CHECKLIST_AR.md) | The client-facing list: what works now, how to try it, what is waiting on them |
| [docs/RAQIB_MATERIALS_REQUEST.md](docs/RAQIB_MATERIALS_REQUEST.md) | What the client still has to send, with fill-in templates |

## Rules worth knowing before you change anything

- The **server decides** what is allowed; the web only shows and asks. Every route declares a permission, and a test fails the build otherwise.
- Migrations are **additive** and hand-written; Prisma only generates the Kysely types (`npx prisma generate`).
- Issued reports, form versions and workflow histories are **immutable**; a deduction rule is a new version, never an edit.
- Values that belong to the client (deductions, shifts, escalation rule, forms, standards) are **configuration**, never invented in code.
- Do **not** run the create-data browser tests against a showcase server; use the read-only live smoke test instead (see operations).
