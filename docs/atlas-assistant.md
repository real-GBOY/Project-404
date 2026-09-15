# Atlas Copilot — AI integration

> Status: v1 shipped (backend + web).
> Module: `atlas/backend/app/realestate/assistant/` — an **Atlas** capability,
> not AURIC Core. Nothing here is promoted into `core/`. Ported from Mizan
> Copilot (`mizan/backend/app/lawfirm/assistant/`, see `docs/assistant.md`) —
> same architecture, same invariant, re-mapped onto Atlas's own domains.

## What it is

Atlas Copilot is a general assistant embedded in Atlas RE OS. It answers
questions about the portfolio's own data ("which projects have the highest
sales velocity?", "how much revenue is outstanding?", "summarise a customer's
history") and performs a small set of operations the app already supports
("create a task to follow up with this lead tomorrow").

It is **not** RAG. There is no vector store, no embeddings, no semantic
search, no document chunking, no separate AI database, and the model never
sees SQL or a database connection. It is an **orchestration layer** over the
existing real-estate use cases.

```
Atlas web
  → POST /api/realestate/copilot/ask   (JwtAuthGuard + ask:ai_conversation)
  → AssistantService                   (agent loop, conversation persistence, observability)
  → OpenAI-compatible Chat Completions  (Groq · openai/gpt-oss-120b)
  → tool call
  → ToolRegistry                       (validate args → RBAC check in tenant → execute)
  → existing Atlas service             (LeadsService, UnitsService, TasksService, …)
  → repository / RLS / transaction
  → Postgres
```

## Provider & model

Configured entirely through environment variables (Atlas-owned config in
`assistant-config.ts`, **separate from `core/kernel/config.ts`**):

| Var | Default | Notes |
|---|---|---|
| `AI_PROVIDER` | `groq` | `groq` or `openai` |
| `AI_MODEL` | `openai/gpt-oss-120b` | provider's model id |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI-compatible base |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | — | key for the selected provider |
| `AI_REQUEST_TIMEOUT_MS` | `45000` | per upstream call |
| `AI_MAX_TOOL_ITERATIONS` | `6` | agent-loop safety cap |
| `AI_MAX_HISTORY_MESSAGES` | `24` | turns sent upstream before older ones drop |
| `AI_MAX_OUTPUT_TOKENS` | `1500` | upper bound on assistant output per turn |
| `AI_SCOPE_ENFORCEMENT` | `strict` | `strict` \| `prompt_only` \| `off` |

The provider boundary is the `AiClient` interface (`ai/ai-client.ts`). v1
ships one implementation, `OpenAiCompatibleClient` (Chat Completions).
Everything above it — orchestration, tools, RBAC, persistence, observability —
is provider-independent.

**With no key set** the module still loads and the rest of the app boots; a
chat request returns `assistant.not_configured` until a key is present — this
was verified locally (no `GROQ_API_KEY` in this dev environment) and the web
UI surfaces it as a normal retryable error, not a crash.

## Authorization — the core guarantee

> **The invariant.** No sequence of model outputs — any tool, any arguments,
> in any order, with any prompt or record content — can cause Atlas to return
> or modify data the authenticated principal is not authorized to access. The
> LLM chooses *which* tool and *what arguments*; it never decides *whether it
> is allowed*. Every change to this module is measured against that sentence.
>
> The security boundary is the **tool registry + Atlas services + Postgres
> RLS**, not the prompt. The system prompt and the scope guard are
> product/UX behaviour; they are not relied on for access control. The
> dedicated regression suite for the invariant is
> `tests/assistant-security.test.ts`.

The assistant creates **no** identity of its own. Every request runs as the
authenticated user in their active tenant:

- `POST /realestate/copilot/ask` is behind the standard `JwtAuthGuard` +
  `PermissionGuard`. `ask:ai_conversation` only gates *reaching* the
  assistant (so an org can restrict it by role); `read:ai_conversation` gates
  the two conversation-history GETs.
- **Every tool call is re-checked**, per call, in `ToolRegistry.run`:
  `lookup → parse args → validate args (Zod) → permissions.can(userId, action, resource) in tenant → execute`.
  The permission check is the same `IPermissionProvider` the HTTP guards use.
- Tools delegate to existing services, which filter by `organization_id` and
  run under Postgres RLS. A user cannot use the assistant to read or change
  anything they could not through the normal app.
- The `POST /realestate/copilot/ask` body (`assistant.schema.ts`) is
  `.strict()` — it accepts only `{ conversationId?, question, currentContext? }`.
  A client-supplied `userId` / `organizationId` / `role` / `permissions` is a
  400, not silently ignored. `currentContext.projectId` / `leadId` /
  `customerId` must match an id pattern (they are disambiguation hints only,
  never an authorization input).

### What the LLM can and cannot do

The model's only output channel is `tool_calls`, dispatched by exact name
against a fixed map of **22 tools** (20 read + 2 write). There is **no**
`execute_sql` / `query` / generic search / HTTP / repository tool. It
**cannot** touch PostgreSQL, Kysely, Prisma, the filesystem, arbitrary
endpoints, or another org's data. A jailbroken model gains nothing: the
registry's `arg-validate → RBAC-check → org-scoped service` runs regardless
of what the model "decides".

Proven by `tests/assistant-security.test.ts` (33 tests total across both
suites, all green):

| Scenario | Result |
|---|---|
| org B reads/resumes org A's conversation | denied (`not found`) |
| org B reads org A's lead via `get_lead` / `search_leads` | denied — org-scoped service + RLS |
| a no-access member asks for lead/task/dashboard data | tool `auth.forbidden`; service never called |
| a `finance_controller` member tries `get_lead` or `update_task_status` | `auth.forbidden` (role lacks `read:lead` / `update:task`) |
| `registry.run("execute_sql", …)` / any unknown name | `assistant.unknown_tool`; no such tool exists |
| injection text in a lead's interest note | delivered as record **data**; a following "injected" tool call is still permission-checked and denied |
| body with `organizationId` / `userId` / `role` | schema rejects (400) |
| model emits a credential-shaped string | `response-guard.ts` redacts it before the user sees it (defence-in-depth, not the boundary) |

### Prompt-injection posture

Message roles are separated (system / user / assistant / tool). The system
prompt's `## Trusted context vs. untrusted data` section tells the model that
tool results, and any text inside them, are records to report on — never
instructions. Short free-text fields (lead interest notes, activity labels,
task titles) still reach the model as tool output, but cannot exceed the
registry's enforcement.

### Audit

Every AI turn writes one `realestate.assistant.query` entry to Core
`audit_logs` (`actorId`, `conversationId`, tool list + ok/err, resource ids
touched, `refused` reason if any). A successful write tool additionally
writes `realestate.assistant.write`. API keys are never in any prompt, tool
result, log line, or audit row.

## Write operations

Only operations the existing use cases already support are exposed as write
tools: `create_task`, `update_task_status` (both → `TasksService`). No
AI-invented mutations — Atlas's `TasksService` has no separate "assign"
method, so (unlike Mizan) there is no `assign_task` tool.

The result the model receives is the *real* outcome of the service call. A
failed write returns a structured error into the agent loop; the model is
instructed (system prompt) to report the failure honestly and never claim
success. A write tool that actually succeeded is recorded via `IAuditLogger`
(`realestate.assistant.write`).

## Tools

Read (20): `get_lead`, `search_leads`, `get_customer`, `search_customers`,
`get_activities`, `get_project`, `search_projects`, `get_unit`,
`search_units`, `get_unit_availability`, `get_reservation`,
`search_reservations`, `get_contract`, `search_contracts`,
`get_payment_plan`, `get_installments`, `get_collections`, `get_outstanding`,
`get_tasks`, `get_dashboard_summary`.

Write (2): `create_task`, `update_task_status`.

Each tool = name + description + Zod parameter schema + required
`{action, resource}` permission (Atlas's own RBAC vocabulary — `read:lead`,
`create:task`, …) + `execute(args, ctx)` that calls one existing service.
Zod schemas are converted to JSON Schema for the upstream request by the same
tiny in-house converter Mizan uses (`tools/zod-to-json-schema.ts`).

### Adding a tool

Same checklist as Mizan's (`tools/tool.ts`'s header comment):
permission → tenant scoping → resource reach → sensitive-field shaping →
enforcement-in-the-service → mutation flag → audit → a cross-tenant +
permission-deny test in `tests/assistant-security.test.ts`.

## Scope — the assistant stays inside Atlas

Same two-layer design as Mizan (`AI_SCOPE_ENFORCEMENT`): `strict` (default)
runs `ScopeGuard`'s heuristics (real-estate entities, Atlas how-to, greetings
— EN + AR) then falls back to a minimal classifier call; `prompt_only` relies
on the system prompt's `## Scope` section alone; `off` disables the
restriction. The refusal text is fixed
(`scope-guard.ts#outOfScopeReply`, localised) and logged as
`assistant chat refused — out of scope`.

## Conversation model

Two tables (`prisma/schema/realestate-assistant.prisma`, migration
`20260915140000_realestate_assistant_llm`), tenant-scoped with RLS like every
other `realestate_*` table:

- `realestate_ai_conversations` — `id, organization_id, user_id, title,
  timestamps`. Private to its owning user within its tenant; `findForOwner`
  is the only read path.
- `realestate_ai_messages` — `role (user|assistant|tool), content, tool_calls
  (jsonb), tool_call_id, tool_name, metadata (jsonb), seq, created_at`.

This migration **replaced** the table's original shape (the canned-answer
stub's UI-card fields: `text/detail/recommend/stats/rows/cites/follow/is_action`,
`role: 'user'|'ai'`) with the Chat-Completions transcript shape Mizan uses.

`seq` (a `BIGSERIAL`) is the transcript's real sort key, not `created_at`:
Postgres's `CURRENT_TIMESTAMP` resolves to the *enclosing transaction's start
time*, so two messages appended in their own fast, back-to-back transactions
(a user turn, then an assistant turn) can tie and sort unpredictably. This
was caught by the ported integration tests during this implementation (not
theoretical) and fixed by adding the strictly-increasing `seq` column rather
than trying to make timestamps unique.

History is bounded (`AI_MAX_HISTORY_MESSAGES`, newest N). No summarization in
v1.

## Context

The UI sends `currentContext` (`{ screen, projectId?, leadId?, customerId? }`)
derived from the route. The system prompt tells the model that "this
project" / "this lead" / "this customer" means those ids. It is a
disambiguation hint only — **never** trusted for authorization.

## Observability

Every chat logs one structured line (`module: "assistant"`): correlation id,
user id, org id, conversation id, provider, model, iterations, tool calls +
per-tool ok/err, prompt/completion/total tokens, latency, ok/fail. No message
text, no portfolio content, no API key.

## Error handling

`AiClient` maps upstream failures to safe `AppError`s: 429 →
`assistant.rate_limited`, timeout → `assistant.timeout`, network / 5xx →
`assistant.upstream_unavailable`, missing key → `assistant.not_configured`.
Malformed / invalid tool arguments, permission failures and tool execution
failures are returned as `ToolResult` errors into the loop (never thrown).
The agent loop has a hard iteration cap and forces a plain-text answer if
it's hit.

## Streaming

Not in v1, same reasoning as Mizan.

## What's different from Mizan's port

- **Route/permission naming kept as Atlas already had it**, rather than
  renamed to match Mizan exactly: `POST /realestate/copilot/ask` (not
  `/ai/chat`), gated by `ask:ai_conversation` + `read:ai_conversation` (not a
  single `use:assistant`). The web client and `assistant.schema.ts` already
  matched this shape before the LLM upgrade.
- **No `assign_task` write tool** — Atlas's `TasksService` doesn't have a
  separate assign method (assignment happens at creation), and inventing one
  for the assistant would violate "no AI-invented mutations".
- **22 tools vs. Mizan's 21** — Atlas's domain (properties, CRM, sales,
  finance, operations) is broader than Mizan's, so the read surface is
  larger (20 vs. 18) to give useful coverage of projects/units/reservations/
  contracts/payment-plans/collections, which have no Mizan equivalent.
- **The `seq` ordering fix** (above) doesn't exist in Mizan's current
  `conversation-repository.ts` — it has the same latent tie-break risk but
  hasn't been caught there yet. Worth porting back.
- A `PaymentsRepository.create()` reference-generation bug (`PM-XXXXX` from a
  5-digit random space, no collision handling) was hit and fixed *during* the
  demo-seeding work for this session, unrelated to the assistant itself, but
  is mentioned here because it was found while building this feature's test
  fixtures.

## Not done / follow-ups

- **A real `GROQ_API_KEY` is not configured in this dev environment.** The
  module loads, the HTTP surface, RBAC, tool registry, conversation
  persistence and the full agent-loop orchestration are all implemented and
  covered by 33 passing tests (using a scripted `AiClient` stub) — the one
  thing not exercised end-to-end against the real Groq API is an actual
  model response. Add the key to `atlas/backend/.env` (`GROQ_API_KEY=...`,
  `AI_PROVIDER=groq` is already the default) and restart the backend to go
  live; no other change is needed.
- **Mobile** — not started (Atlas has no mobile assistant screen yet).
- **Settings toggle** to disable Copilot per-org, same follow-up as Mizan's.
- **Conversation summarization** for very long histories.
- Porting the `seq`-column ordering fix back to Mizan's own
  `lawfirm_ai_messages` (see above).
