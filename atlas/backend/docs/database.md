# Atlas RE OS — database implementation

How the schema was built, and exactly how every table relates to every other
one. Written from the actual migration files (`prisma/migrations/`), not from
memory — every FK listed below is `grep`-verified against the SQL.

## Topology

Atlas has its **own** Postgres database (`atlas`, `atlas_test`), completely
separate from Mizan's (`auric`). It is not a schema-within-a-schema trick —
it's a second full AURIC deployment that happens to share Core's *source code*
via relative import, nothing else:

- Own `main.ts`, own port, own JWT secret, own users/organizations tables.
- Own Prisma project: `atlas/backend/prisma/schema/*.prisma` (Atlas's own
  models only) + `atlas/backend/prisma/migrations/` (copies of Core's
  baseline migrations, followed by Atlas-only ones).
- Never touches the root repo's `prisma/` directory or Mizan's `auric`
  database. Nothing in `core/` or `mizan/` changed to build this.

## How the schema itself is defined

Same split as the rest of the repo: **Prisma owns the schema definition**
(`.prisma` files → generates Kysely TypeScript types), but the actual
`CREATE TABLE` / constraints / RLS are **hand-written SQL migrations**, not
Prisma-generated ones — Prisma can't express composite foreign keys, `CHECK`
constraints, or row-level security policies, all of which this schema uses
heavily.

Three migrations, applied in order:

1. `20260829...` through `20260908...` — copied verbatim from Core's own
   baseline (creates `users`, `organizations`, `roles`, `permissions`,
   `audit_logs`, `notifications`, `files`, etc. — the platform tables every
   AURIC deployment needs).
2. `20260914120000_realestate` — the entire Atlas domain: 25 tables, indexes,
   `CHECK` constraints, triggers, RLS policies.
3. `20260914130000_unit_code_scoped_to_project` — a follow-up fix (see
   "Things worth knowing" below).

## Tenant isolation (every table)

Every `realestate_*` table has an `organization_id` column and:

```sql
ALTER TABLE realestate_x ENABLE ROW LEVEL SECURITY;
ALTER TABLE realestate_x FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON realestate_x
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
```

Postgres enforces this at the row level — even a raw `SELECT *` from a
compromised query can't see another org's rows. The app also filters by
`organization_id` explicitly in every repository, but that's defense in
depth; RLS is the real backstop. `FORCE` means even the table owner is
filtered (a plain `ENABLE` would let the owning role bypass it).

IDs are prefixed strings (`prj_`, `led_`, `rsv_`, …), not integers — generated
with `nanoid`, e.g. `prj_uxoDXoDDakAq1GaJS51ID`.

## The real foreign keys

Only **9 FK constraints exist in the whole schema**, and every single one is
a *composite* key — `(organization_id, parent_id) → parent(organization_id, id)`,
never just `(parent_id) → parent(id)`. That's deliberate: it makes a row
tagged with the wrong tenant physically impossible to insert (the FK itself
rejects it), rather than relying on a trigger to catch it after the fact.

```
realestate_projects (root)
 └─ realestate_buildings          (org_id, project_id) → projects
     └─ realestate_units          (org_id, building_id) → buildings
                                   (org_id, project_id)  → projects   [unit has BOTH]
 └─ realestate_price_lists        (org_id, project_id) → projects

realestate_customers (root)
 └─ realestate_customer_units     (org_id, customer_id) → customers

realestate_reservations (root)
 └─ realestate_contracts          (org_id, reservation_id) → reservations  [nullable — a contract can exist without one]
     └─ realestate_payment_plans  (org_id, contract_id) → contracts
         └─ realestate_installments (org_id, payment_plan_id) → payment_plans

realestate_workflows (root)
 └─ realestate_workflow_steps     (org_id, workflow_id) → workflows

realestate_ai_conversations (root)
 └─ realestate_ai_messages        (org_id, conversation_id) → conversations
```

That's the whole FK graph. Every table not listed as a child above —
`realestate_leads`, `realestate_customers`, `realestate_activities`,
`realestate_followups`, `realestate_reservations`, `realestate_commissions`,
`realestate_payments`, `realestate_financial_reports`, `realestate_tasks`,
`realestate_workflows`, `realestate_approvals`, `realestate_documents`,
`realestate_ai_conversations`, `realestate_ai_insights`,
`realestate_org_settings` — is a **root table**: it only carries
`organization_id`, no parent FK at all.

## The other relationships (real, but not FK-enforced)

Most of the "who references who" in this schema is plain columns, checked by
application code, not the database. This mirrors the exact same convention
Mizan's backend uses — a Prisma-level FK is reserved for a strict
parent/child pair *within one feature module*; a reference that crosses
feature boundaries (sales referencing a unit that properties owns, a task
referencing "whatever it's about") is a plain string column instead, so the
Prisma schema files for each domain don't have to import each other's models.

| Column | Points at | Enforced by |
|---|---|---|
| `leads.agent_id`, `customers.agent_id`, `reservations.agent_id`, `commissions.agent_id`, `tasks.assignee_id`, … | Core `users.id` | app code only |
| `leads.interest_unit_id` | `units.id` | app code only (nullable, informational) |
| `customers.primary_project_id` | `projects.id` | app code only |
| `units.current_customer_id`, `units.current_agent_id` | `customers.id` / `users.id` | app code only — set when a unit is reserved/sold |
| `reservations.unit_id`, `contracts.unit_id`, `payment_plans.unit_id`, `payments.unit_id` | `units.id` | app code only |
| `reservations.customer_id`, `contracts.customer_id`, `payment_plans.customer_id`, `payments.customer_id` | `customers.id` | app code only |
| `payments.installment_id` | `installments.id` | app code only (nullable) |
| `documents.file_id` | Core `files.id` | app code only — actual bytes live in Core's file storage, this table is metadata only |
| `financial_reports.owner_id`, `ai_conversations.user_id` | Core `users.id` | app code only |

And a **polymorphic** pattern used on four tables — a generic
`(related_type, related_id)` pair instead of a dedicated FK per possible
target, since "what this is about" can be a lead, a customer, a unit, a
contract, etc.:

- `realestate_activities.related_type` / `related_id`
- `realestate_tasks.related_type` / `related_id`
- `realestate_approvals.related_type` / `related_id`
- `realestate_documents.related_type` / `related_id`

No FK is possible here (Postgres can't FK to "whichever table `related_type`
names"), so these are validated by the application layer only.

## Tables by domain

**properties** — `projects`, `buildings`, `units` (materialized rows,
generated by the same deterministic formula the frontend mock uses — not
free-typed), `price_lists`.

**crm** — `leads` (also backs the Pipeline kanban and the Deals screen — see
"Things worth knowing"), `customers`, `customer_units` (ownership join
table), `activities`, `followups`.

**sales** — `reservations`, `contracts`, `payment_plans`, `installments`
(a real generated-and-persisted schedule, not computed on the fly),
`commissions`.

**finance** — `payments`, `financial_reports`. *Collections* and
*Outstanding* are **not tables** — they're live aggregate queries over
`installments` + `payments`, recomputed on every request.

**operations** — `tasks`, `workflows` + `workflow_steps`, `approvals`,
`documents` (metadata only; bytes live in Core's `FilesModule`).

**assistant** (AI Copilot) — `ai_conversations`, `ai_messages`,
`ai_insights`. No LLM — server-side keyword matching, real persisted rows.

**admin** — one real table, `org_settings` (one row per org). Team, Roles,
Audit Logs and Notifications have **no tables of their own** — they're thin
read/write adapters over Core's existing `users` / `organizations` /
`roles` / `audit_logs` / `notifications` tables.

## Things worth knowing

**Lead / Pipeline / Deals are one table.** The frontend mock had these as
three separate, not-quite-reconciled concepts. The real schema has one
`realestate_leads` table with a `stage` column (the 9-value pipeline funnel:
new → qualified → contacted → viewing → negotiation → reserved → contracted →
sold → lost) plus nullable `probability_pct` / `expected_close_date` columns
that get set once a lead is "tracked as a deal." Pipeline = group leads by
`stage`. Deals = leads where those two columns aren't null. No duplicate ID
schemes, no drift between screens.

**Unit codes are unique per project, not per org.** This was a real bug I
found and fixed via the second migration: a unit code like `A-0904` is only
meant to be unique within its own project (every project can have its own
"Building A"), but the first migration constrained it organization-wide,
which would collide the moment two projects each generated a floor plate.
Fixed by dropping and re-adding the unique constraint scoped to
`(organization_id, project_id, code)`.

**Money is `BIGINT` EGP**, not a formatted string — the frontend mock stored
amounts as inconsistent display strings ("EGP 5.8M", "9.84B", plain
integers depending on the screen); the real schema stores one integer and
lets the client format it however a given screen wants.
