# Mizan Copilot — AI integration

> Status: v1 shipped (backend + web). Mobile deferred (Phase 2 placeholder).
> Module: `mizan/backend/app/lawfirm/assistant/` — a **Mizan** capability, not
> AURIC Core. Nothing here is promoted into `core/`.

## What it is

Mizan Copilot is a general assistant embedded in Mizan. It answers questions
about the firm's own data ("what hearings do I have tomorrow?", "what invoices
are overdue?", "summarize this matter") and performs a small set of operations
the firm already supports ("create a task for this matter to review the contract
tomorrow").

It is **not** RAG. There is no vector store, no embeddings, no semantic search,
no document chunking, no separate AI database, and the model never sees SQL or a
database connection. It is an **orchestration layer** over the existing law-firm
use cases.

```
Mizan UI (web)
  → POST /api/ai/chat            (JwtAuthGuard + use:assistant)
  → AssistantService             (agent loop, conversation persistence, observability)
  → OpenAI-compatible Chat Completions   (Groq · openai/gpt-oss-120b)
  → tool call
  → ToolRegistry                 (validate args → RBAC check in tenant → execute)
  → existing Mizan service       (TasksService, MattersService, …)
  → repository / RLS / transaction
  → Postgres
```

## Provider & model

Configured entirely through environment variables (Mizan-owned config in
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

The provider boundary is the `AiClient` interface (`ai/ai-client.ts`). v1 ships
one implementation, `OpenAiCompatibleClient` (Chat Completions). Everything above
it — orchestration, tools, RBAC, persistence, observability — is
provider-independent.

**Note on the brief.** The original spec named the OpenAI *Responses* API +
`gpt-5.6-terra`. The deployment uses Groq, which only exposes the OpenAI-*
compatible* Chat Completions API, so that is what v1 implements. A Responses-API
provider can be added later as a second `AiClient` with no change to callers.

## Authorization — the core guarantee

> **The invariant.** No sequence of model outputs — any tool, any arguments, in
> any order, with any prompt or document content — can cause Mizan to return or
> modify data the authenticated principal is not authorized to access. The LLM
> chooses *which* tool and *what arguments*; it never decides *whether it is
> allowed*. Every change to this module is measured against that sentence.
>
> The security boundary is the **tool registry + Mizan services + Postgres RLS**,
> not the prompt. The system prompt and the scope guard are product/UX behaviour;
> they are not relied on for access control. The dedicated regression suite for
> the invariant is `tests/assistant-security.test.ts`.

The assistant creates **no** identity of its own. Every request runs as the
authenticated user in their active tenant:

- `POST /api/ai/chat` is behind the standard `JwtAuthGuard` + `PermissionGuard`.
  `use:assistant` only gates *reaching* the assistant (so a firm can switch it
  off for a role).
- **Every tool call is re-checked**, per call, in `ToolRegistry.run`:
  `lookup → parse args → validate args (Zod) → permissions.can(userId, action, resource) in tenant → execute`.
  The permission check is the same `IPermissionProvider` the HTTP guards use.
- Tools delegate to existing services, which filter by `organization_id` and run
  under Postgres RLS. A user cannot use the assistant to read or change anything
  they could not through the normal app.
- The `POST /api/ai/chat` body (`assistant.schema.ts`) is `.strict()` — it
  accepts only `{ conversationId?, message, currentContext? }`. A client-supplied
  `userId` / `organizationId` / `role` / `permissions` is a 400, not silently
  ignored. `currentContext.matterId` / `clientId` must match an id pattern (they
  are disambiguation hints only, never an authorization input).

### What the LLM can and cannot do

The model's only output channel is `tool_calls`, dispatched by exact name against
a fixed map of 21 tools. There is **no** `execute_sql` / `query` / generic search
/ HTTP / repository tool. It **cannot** touch PostgreSQL, Kysely, Prisma, the
filesystem, document file contents (no tool returns bytes or OCR), arbitrary
endpoints, or another org's data. A jailbroken model gains nothing: the
registry's `arg-validate → RBAC-check → org-scoped service` runs regardless of
what the model "decides".

Proven by the integration tests (`tests/assistant.integration.test.ts` →
"security boundary"):

| Scenario | Result |
|---|---|
| firm B resumes / reads firm A's conversation | denied (`not found`) |
| firm B reads firm A's matter via `get_matter` / `search_matters` | denied — org-scoped service + RLS |
| user without `read:matter` asks for a case summary | tool `auth.forbidden`; service never called |
| user without `read:client` asks for client data | tool `auth.forbidden` |
| `registry.run("execute_sql", …)` / any unknown name | `assistant.unknown_tool`; no such tool exists |
| injection text in a matter `description` / client `note` | delivered as record **data**; a following "injected" tool call is still permission-checked and denied |
| body with `organizationId` / `userId` / `role` | schema rejects (400) |
| model emits a credential-shaped string | `response-guard.ts` redacts it before the user sees it (defence-in-depth, not the boundary) |

### Prompt-injection posture

Message roles are separated (system / user / assistant / tool). Document **body
text is never retrieved** — the strongest mitigation. The system prompt's
`## Trusted context vs. untrusted data` section tells the model that tool
results, and any text inside them, are records to report on — never
instructions. Short free-text fields (matter descriptions, client notes, task
titles, activity labels) still reach the model as tool output, but cannot exceed
the registry's enforcement.

### Audit

Every AI turn writes one `lawfirm.assistant.query` entry to Core `audit_logs`
(`actorId`, `conversationId`, tool list + ok/err, resource ids touched, `refused`
reason if any). A successful write tool additionally writes
`lawfirm.assistant.write`. API keys are never in any prompt, tool result, log
line, or audit row.

There is no AI-specific bypass anywhere.

## Write operations

Only operations the existing use cases already support are exposed as write
tools: `create_task`, `update_task`, `assign_task` (all → `TasksService`). No AI
invented mutations.

The result the model receives is the *real* outcome of the service call. A
failed write returns a structured error into the agent loop; the model is
instructed (system prompt) to report the failure honestly and never claim
success. The system prompt also asks it to confirm consequential writes with the
user first.

A write tool that actually succeeded is recorded via `IAuditLogger`
(`lawfirm.assistant.write`).

## Tools

Read: `get_client`, `search_clients`, `get_matter`, `search_matters`,
`get_matter_summary`, `get_matter_activity`, `get_matter_hearings`,
`get_matter_tasks`, `get_matter_documents`, `get_hearings`, `get_tasks`,
`get_calendar_events`, `get_invoice`, `get_client_invoices`, `get_invoices`,
`get_payments`, `get_expenses`, `get_dashboard_summary`.

Write: `create_task`, `update_task`, `assign_task`.

Each tool = name + description + Zod parameter schema + required
`{action, resource}` permission + `execute(args, ctx)` that calls one existing
service. Zod schemas are converted to JSON Schema for the upstream request by a
tiny in-house converter (`tools/zod-to-json-schema.ts`) — no new dependency.

### Adding a tool

**Each tool is an AI-accessible API endpoint.** Review a new one exactly as you
would review a new route — the checklist is also at the top of `tools/tool.ts`:

1. **Permission** — what `{action, resource}` does it require? (never `null`)
2. **Tenant** — does the underlying service scope by `organization_id` *and* is
   the table under RLS? (if not, the tool is not safe to add)
3. **Resources** — which records can it reach? Only what the permission implies?
4. **Sensitive fields** — does the service view shape exclude internal fields,
   credentials, other-user PII beyond names? No `JSON.stringify(rawRow)`.
5. **Authorization enforcement** — is it in the *service*, not just the tool?
   The tool's own `permissions.can()` check is necessary, not sufficient.
6. **Mutation** — does it write? Then `mutates: true`, and the model must confirm
   consequential writes (system prompt), and it lands in `lawfirm.assistant.write`.
7. **Auditable** — the per-turn `lawfirm.assistant.query` row records it; a write
   also gets its own row. Resource ids touched are captured from the args.
8. **Test** — add a cross-tenant + a permission-deny case to
   `tests/assistant-security.test.ts`.

## Scope — the assistant stays inside Mizan

Two layers keep the Copilot on-topic (the firm's practice-management data and
Mizan how-to), configurable with `AI_SCOPE_ENFORCEMENT`:

| value | behaviour |
|---|---|
| `strict` *(default)* | `ScopeGuard` runs a pre-flight check on every message. In-scope heuristics (firm entities, Mizan how-to, greetings — EN + AR) and an out-of-scope heuristic (coding, general knowledge, content generation) settle the common cases with no model call; a terse follow-up on an existing thread passes; anything left gets one minimal classifier call (`IN_SCOPE` / `OUT_OF_SCOPE`, ~250 tokens). Out-of-scope → a fixed refusal, persisted as the assistant turn, **no agent loop, no tools**. Fails open on a classifier error (the system prompt is the backstop). |
| `prompt_only` | no pre-check; the system prompt's **## Scope** section is the only guard |
| `off` | no restriction |

The refusal is identical every time (`scope-guard.ts#outOfScopeReply`, localised),
and the turn is logged as `assistant chat refused — out of scope` with the `via`
reason. Covered by `tests/assistant.integration.test.ts` → "scope gate".

## Conversation model

Two tables (`prisma/schema/lawfirm-assistant.prisma`, migration
`20260909120000_lawfirm_assistant`), tenant-scoped with RLS like every other
`lawfirm_*` table:

- `lawfirm_ai_conversations` — `id, organization_id, user_id, title, timestamps`.
  Private to its owning user within its tenant; `findForOwner` is the only read
  path.
- `lawfirm_ai_messages` — `role (user|assistant|tool), content, tool_calls
  (jsonb), tool_call_id, tool_name, metadata (jsonb), created_at`.

History is bounded (`AI_MAX_HISTORY_MESSAGES`, newest N). No summarization in v1
— a `TODO` if conversations grow long enough to matter. `metadata` holds only
non-sensitive bookkeeping (model, latency, token usage); raw legal content is
never logged.

## Context

The UI sends `currentContext` (`{ screen, matterId?, clientId? }`) derived from
the route. The system prompt tells the model that "this matter" / "this client"
means those ids. It is a disambiguation hint only — **never** trusted for
authorization. The model retrieves what it needs per request; the whole database
is never dumped into the prompt.

## Observability

Every chat logs one structured line (`module: "assistant"`): correlation id,
user id, org id, conversation id, provider, model, iterations, tool calls +
per-tool ok/err, prompt/completion/total tokens, latency, ok/fail. No message
text, no legal content, no API key (pino redacts `authorization`).

## Error handling

`AiClient` maps upstream failures to safe `AppError`s: 429 →
`assistant.rate_limited`, timeout → `assistant.timeout`, network / 5xx →
`assistant.upstream_unavailable`, missing key → `assistant.not_configured`.
Malformed / invalid tool arguments, permission failures and tool execution
failures are returned as `ToolResult` errors into the loop (never thrown), so
one bad tool call doesn't kill the turn. The agent loop has a hard iteration cap
and forces a plain-text answer if it's hit.

## Streaming

Not in v1. The agent loop + tool round-trips make token streaming low-value for
the first cut, and it would mean SSE plumbing through Fastify. `AssistantService`
is structured so a streaming variant can be added without changing the HTTP
contract (the loop already produces discrete events — assistant turn, tool call,
tool result, final answer).

## Deployment

The assistant adds config and one DB migration; no new infrastructure.

**Backend (AWS ARM VPS — `docs/deployment.md`, [systemd + nginx + Postgres]).**
All secrets and config live in **`/opt/mizan/.env`** (mode `600`), loaded by the
`mizan.service` unit via `EnvironmentFile=/opt/mizan/.env`. Add:

```
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-120b
AI_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=<the rotated key>
# optional overrides — defaults shown in .env.example
# AI_REQUEST_TIMEOUT_MS=45000
# AI_MAX_TOOL_ITERATIONS=6
# AI_MAX_HISTORY_MESSAGES=24
```

Then `sudo systemctl restart mizan`. The `20260909120000_lawfirm_assistant`
migration is applied automatically on boot (`migrateToLatest` in `main.ts` →
`prisma migrate deploy` against the box's `auric` DB) — no manual migrate step.
With no key set the module still loads and the rest of the app boots; a chat
request returns `assistant.not_configured` until `GROQ_API_KEY` is present.

The key is **not** committed and **not** in `scripts/deploy-local.sh` /
`scripts/deploy-vps.sh` — it is set once, by hand, in `/opt/mizan/.env` on the
box, exactly like `AURIC_JWT_SECRET` and the Postgres passwords.

**Frontend (Vercel, project `mizan-web`).** No new environment variables — the
web client reaches the assistant through the same `VITE_API_BASE` it uses for
every other call. Redeploy `mizan/web` to ship the wired-up "Ask Mizan".

## Web UI

The existing "Ask Mizan" launcher in the top bar (`features/assistant/`), rewired
from the canned stub to `POST /api/ai/chat`. Same visual shell; adds a loading
state, error + retry, and tool-activity chips. Conversation id is kept in
component state for the session; "New chat" resets it. In-flight turns are
cancelled (AbortController) when the dialog closes or unmounts.

**Frontend security posture** (audited):

- The client sends **only** `{ conversationId?, message, currentContext? }`
  (`assistant.api.ts`). No `userId` / `organizationId` / `role` — identity is the
  JWT, server-side. `httpClient` adds only `Authorization` + `content-type`.
- **No XSS from model output.** The answer is rendered as `{text}` inside a
  `<p>` — React auto-escapes. There is **no** `dangerouslySetInnerHTML`, no
  markdown/HTML renderer anywhere in the web app, so a model that echoes
  `<script>` from a poisoned document renders it as literal text. Tool names and
  error strings are likewise escaped text.
- `if (!can("use:assistant")) return null` hides the launcher — **UX only**; the
  backend independently enforces the permission and every per-tool RBAC check.
- `currentContext` is derived from the route (`lib/current-context.ts`) and
  validated against an id / slug pattern; a malformed URL segment drops the hint
  rather than sending prose. The backend re-validates and would reject it anyway.
- `conversationId` is client-held and **server-validated for ownership** (owner +
  org) on every use — tampering in devtools yields "not found".
- The MSW handler for `/ai/chat` is Vitest-only; it is not in the production
  bundle.
- Pre-existing, not AI-specific: the refresh token lives in `localStorage`
  (`token-store.ts`, flagged there as a hardening item). The AI feature adds no
  new XSS surface, so it does not worsen this.

Hidden entirely for a user without `use:assistant`.

## Not done / follow-ups

- **Mobile** (`mizan/mobile/src/features/assistant/`) still shows the preview
  screen. Wiring it is the same shape as web: a `sendChat` client + the existing
  `AssistantScreen` / `ConfirmActionCard`.
- **Settings toggle.** `settings.aiAssistantEnabled` exists in the web settings
  UI but is not yet read by the backend. Honoring it would be a check in
  `AssistantController` / `AssistantService` against `SettingsService`.
- **Conversation summarization** for very long histories.
- **Streaming** (see above).
- A reusable AI-infra abstraction is *not* extracted into Core — if one proves
  out across a second product, revisit then (per the architectural constraint).
