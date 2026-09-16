# Atlas RE OS — everything for the LinkedIn post

Pulled straight from the repo (`README.md`, `SHOWCASE.md`, `docs/atlas-assistant.md`,
`docs/atlas-deployment.md`, `nav.ts`, backend module tree) — no rounding up,
nothing invented. Use this as raw material; the "post angles" section at the
bottom has ready-to-adapt hooks.

---

## 1. The one-liner

**Atlas RE OS** is a real-estate developer operating system — CRM, property
inventory, sales, payment plans, and finance — built for an Egyptian property
developer's internal sales and ops team.

It's **product #2** on top of **AURIC** (codename *Project 404*), a
domain-agnostic application foundation whose first product was **Mizan**, a
multi-tenant law-firm ERP. Atlas exists to answer one question honestly: after
building one real product on the foundation, which parts of it were actually
reusable, and which were quietly shaped like a law firm? Building a second,
structurally independent product — own package, own database, different
domain — was the only way to find out for real instead of guessing.

> Atlas isn't a demo or a re-skin of Mizan. Same core, completely different
> business: leads and units instead of matters and hearings.

**Live:** `https://atlas.100-26-109-162.sslip.io` (own VPS deployment, own
database, no shared infra with Mizan).

---

## 2. What it actually does — the product surface

9 sidebar groups, all live against a real backend (not mock data):

| Area | Screens |
|---|---|
| **Overview** | Executive dashboard |
| **CRM** | Leads · Customers · Pipeline (kanban) · Activities · Follow-ups |
| **Properties** | Projects · Buildings · Units · Availability · Pricing |
| **Sales** | Reservations · Deals · Contracts · Payment Plans · Commissions |
| **Finance** | Payments · Installments · Collections · Outstanding Payments · Financial Reports |
| **Operations** | Tasks · Workflows · Approvals · Documents |
| **Analytics** | Sales · Leads · Project Performance · Agent Performance · Revenue · Inventory |
| **AI** | AI Copilot · Insights · Recommendations |
| **Administration** | Team · Roles & Permissions · Organization Settings · Audit Logs |

That's the full lifecycle: a lead comes in → moves through the pipeline →
reserves a unit → signs a contract → goes on a payment plan → installments get
collected → finance reports roll it up — with tasks/approvals/workflows and
role-based admin wrapped around all of it.

Every list screen has **real backend-driven search and filtering** — a
hand-written SQL relevance algorithm (exact match → prefix → word-boundary →
substring, weighted across columns), not a client-side `.includes()` — and
every filter dropdown is backed by a real query param, not a styled `<select>`
with hardcoded options. KPI tallies query the unfiltered dataset separately so
numbers never silently shrink when a filter is applied.

---

## 3. The AI Copilot

Atlas ships its own embedded assistant ("Atlas Copilot") — answers questions
about the portfolio's own data ("which projects have the highest sales
velocity?", "how much revenue is outstanding?") and performs real operations
("create a follow-up task for this lead tomorrow").

- **Not RAG.** No vector store, no embeddings, no document chunking. It's a
  tool-orchestration layer over the app's existing use cases — the model never
  sees SQL or a database connection.
- **22 tools** (20 read + 2 write) — `get_lead`, `search_units`,
  `get_dashboard_summary`, `create_task`, `update_task_status`, etc. No
  `execute_sql` / generic query tool exists — the model literally cannot touch
  the database directly.
- **Real inference**, not a scripted demo: Groq, `openai/gpt-oss-120b`, via an
  OpenAI-compatible Chat Completions API. Provider is swappable (Groq or
  OpenAI) through env vars.
- **The security invariant:** *no sequence of model outputs — any tool, any
  arguments, any prompt content — can return or modify data the authenticated
  user isn't authorized to see.* The LLM picks *which* tool and *what
  arguments*; it never decides *whether it's allowed*. Every tool call is
  re-checked against RBAC and tenant scoping on every single call, regardless
  of what the model "decides." Proven by a dedicated 33-test security suite:
  cross-tenant reads, permission-denied roles, prompt-injection payloads
  embedded in lead notes, and a client trying to smuggle `organizationId` /
  `userId` in the request body — all denied.
- Runs on `core/assistant` — a shared AI-orchestration engine (LLM boundary,
  RBAC-gated tool pipeline, scope-guard, conversation store) that both Mizan
  and Atlas built independently and near-identically, so it got pulled into
  the shared foundation rather than let a third product copy it again.

---

## 4. Architecture — built on a shared foundation, not from scratch

```
AURIC CORE  ◀──  ATLAS BACKEND  ◀──  atlas/web
core/ never imports atlas/ · one-way dependency, enforced (grep-verified empty)
```

- **AURIC Core** (`core/`) supplies identity/auth, RBAC, multi-tenancy, file
  storage, audit trail, notifications, an event bus with transactional
  outbox, and the AI-orchestration engine — domain-agnostic, knows nothing
  about real estate or law firms.
- **Atlas backend** (`atlas/backend/app/realestate/`) is a fully separate npm
  package — own `package.json`, own Prisma migration history, own Postgres
  database (`atlas`, physically separate from Mizan's `auric`). It reaches
  Core only through defined contract interfaces (`IUserProvider`,
  `IPermissionProvider`, `ITenantContext`, `IFileStorage`, `IAuditLogger`,
  `IEventBus`) — never a Core table or concrete class directly.
- **Atlas web** (`atlas/web/`) talks to its backend over HTTP/JSON only — no
  server code imported into the frontend.
- **Multi-tenant by construction:** every tenant table has
  `organization_id NOT NULL`; Postgres **row-level security** is the actual
  enforcement boundary (not application code, not a forgotten `WHERE`
  clause) — the app connects as a `NOBYPASSRLS` role, so RLS is exercised for
  real, and it's integration-tested against cross-tenant leakage on a
  throwaway database before any feature lands.
- **Money is never summed across currencies** — financial values are
  `{ currency, amount }[]`, invoice/payment-plan math is server-authoritative.
- **English-only by design** — Atlas is a single-market internal tool for an
  Egyptian developer's own sales team, so no localization layer (unlike Mizan,
  which is Arabic-first/RTL).

---

## 5. Stack

**Backend:** TypeScript · Node 22.12+/24 · PostgreSQL · **NestJS 11 on
Fastify 5** · **Kysely** (typed SQL, no ORM) · **Prisma** (schema + migrations
only, no Prisma Client) · Zod · `@nestjs/swagger` (OpenAPI docs) ·
`jsonwebtoken` + Argon2id · `pino` structured logging · Vitest · ESLint 9 +
Prettier.

**Frontend:** React 19 · Vite · TypeScript · **Tailwind v4** (CSS `@theme`
tokens) · Radix UI primitives · TanStack Query v5 · React Router v7 ·
`lucide-react` icons.

**Design origin:** the entire app was scaffolded directly from a single
Claude-generated design prototype (`.dc.html` canvas file) — router, nav, full
UI kit, every domain component and feature page, mirroring the design's own
structure screen-for-screen.

**Deployment:** own VPS (systemd + nginx + Let's Encrypt via sslip.io), own
database — independently provisioned from Mizan, same operational pattern
repeated for a second product.

---

## 6. The numbers

- **23** `realestate_*` database tables, own Prisma migration history, own
  Postgres database
- **8** backend domain modules: CRM · Properties · Sales · Finance ·
  Operations · Admin · Dashboard · Assistant (AI Copilot)
- **12** frontend feature areas · **111** frontend source files
- **22** AI Copilot tools (20 read + 2 write), **0** generic SQL/query tool
  exposed to the model
- **85** tests green (80 backend across 14 files + 5 web) — including
  integration suites that boot the real app against a throwaway Postgres to
  prove tenant isolation, and a live-provider suite that calls the real Groq
  API (not mocked) to prove tool-calling and scope-refusal actually work
- **33** dedicated AI-security regression tests (cross-tenant access,
  permission denial, prompt injection, request-body tampering) — all passing
- **0** lines of Atlas-specific business logic living inside the shared
  foundation (`grep -rn "atlas/" core/` is empty — verified, not assumed)

---

## 7. Interesting engineering details worth a post on their own

- **A hand-rolled SQL relevance-ranking search** instead of a search service
  or a new dependency — scores exact → prefix → word-boundary → substring,
  weighted across columns, entirely inside the query.
- **An AI assistant whose safety boundary is the permission system, not the
  prompt.** The system prompt tells the model tool results are data to report
  on, never instructions — but that's UX polish. The actual guarantee is
  enforced by re-running RBAC + tenant scoping on every tool call,
  independent of anything the model outputs.
- **Shipped only after re-testing the running app, not just the diff** — a
  login-session race condition, a `NaN` on a detail page, and a duplicate-key
  bug in global search were all caught by manually re-verifying the live app
  against known data before it went out, not by reading a code diff.
- **A second product proved the foundation, rather than assumed it.** Zero
  Core code branches on "is this Mizan or Atlas" — the one-way dependency
  (`core/` never imports either product) is grep-verified empty, not just
  claimed in a README.
- **Transactional outbox pattern** for events — a state change and its event
  row are written in the same database transaction, delivered by a worker,
  with a dead-letter queue for failures instead of a silently dropped event.

---

## 8. Post angles (pick one, don't try to fit all of this in)

- **"I built a second product on my own SaaS foundation to see if the
  foundation actually held up"** — the honest engineering story: Mizan (law
  firm ERP) came first, Atlas (real-estate OS) is the test. What was reusable
  (auth, tenancy, RBAC, audit, files, AI orchestration), what wasn't
  (localization, some domain assumptions) — and the important part: it's
  verified with `grep`, not vibes.
- **"An AI Copilot whose safety guarantee is one sentence, not a system
  prompt"** — lead with the invariant: no model output, however clever, can
  bypass the permission system. Show the 33-test security suite as proof.
- **"From a single AI-generated design file to a working, tested app"** —
  the whole frontend (router, nav, UI kit, every screen) traces back to one
  Claude Design prototype file, built out screen-for-screen with a real
  backend behind it.
- **"Multi-tenancy you can actually trust"** — Postgres RLS as the real
  enforcement boundary, not application code; the app runs as a
  `NOBYPASSRLS` role on purpose so a forgotten `WHERE` clause literally cannot
  leak data across tenants.
- **Straight demo post** — screenshot/GIF of the CRM pipeline → unit
  reservation → payment plan flow, plus the Copilot answering a real question
  about the (demo) portfolio, captioned with the numbers from §6.

---

## 9. Where to look for more / screenshots

- Live app: `https://atlas.100-26-109-162.sslip.io`
- `README.md` § Atlas — quick start, run-it-yourself instructions
- `SHOWCASE.md` — the combined Mizan + Atlas fact sheet this file was drawn
  from (has the side-by-side comparison with Mizan if that's a useful post
  angle too)
- `docs/atlas-assistant.md` — full Atlas Copilot writeup (security invariant,
  tool list, scope-guard design)
- `docs/atlas-deployment.md` — how it's deployed
- `atlas/web/src/app/router/nav.ts` — the full navigation/feature map
