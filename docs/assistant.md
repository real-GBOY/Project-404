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
  they could not through the normal app. Proven by the integration tests
  (`tests/assistant.integration.test.ts`): firm B cannot resume firm A's
  conversation, cannot read firm A's matter through a tool, and a `read_only`
  user's `create_task` call is refused and not executed.

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
state, error + retry, and tool-activity chips. Hidden entirely for a user
without `use:assistant`. Conversation id is kept in component state for the
session; "New chat" resets it.

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
