# `core/assistant` — AI Copilot infrastructure

## 1. What it is

The generic AI orchestration layer behind every product's "Copilot": an LLM
provider boundary, a tool-execution pipeline gated by the same RBAC/tenancy
every HTTP request goes through, a scope-gate engine, a conversation store, and
the agent loop that ties them together. **No controller, no HTTP surface, no
permission strings, no domain knowledge.**

Extracted from Mizan Copilot (`mizan/backend/app/lawfirm/assistant`), which
shipped first as a product-local module. Atlas Copilot
(`atlas/backend/app/realestate/assistant`) duplicated it near-verbatim. This
module is that duplicated ~70% pulled out once; the remaining ~30% (tools,
system prompt, scope vocabulary, permissions, the controller) stays in each
product because it *is* the product.

## 2. Why it exists

Two products independently built the same orchestration loop, tool registry,
and conversation store, differing only in: which tools exist, what the system
prompt says, what counts as "in scope", and what permission gates the surface.
None of that is Core's business — but the mechanism around it is identical and
was about to be built a third time.

## 3. What it owns

- `AiClient` (`domain/ai-client.ts`) + `OpenAiCompatibleClient`
  (`infrastructure/openai-compatible-client.ts`) — the LLM provider boundary.
  One implementation today (Groq / OpenAI Chat Completions).
- `AssistantTool` / `ToolContext` / `ToolResult` (`domain/tool.ts`) — the shape
  every product tool implements.
- `ToolRegistry` (`application/tool-registry.ts`) — lookup → parse → Zod
  validate → **RBAC check via `IPermissionProvider`, in the tenant** → execute.
  Never throws; every failure is a `ToolResult` the model can see and explain.
- `ScopeGuard` (`application/scope-guard.ts`) — heuristic → classifier →
  fail-open decision engine. The vocabulary (regex, classifier prompt, refusal
  text) is 100% product-supplied via `SCOPE_GUARD_CONFIG`.
- `ConversationRepository` (`infrastructure/conversation-repository.ts`) — the
  `ai_conversations` / `ai_messages` store. Owner + org scoped; `findForOwner`
  is the only read path.
- `AssistantService` (`application/assistant-service.ts`) — the agent loop:
  build transcript → call the model → run requested tools → persist → audit →
  guard the response → return. Audit actions are namespaced by the product's
  own `domainKey` (`{domainKey}.assistant.query` / `.write`).
- `response-guard.ts` — defence-in-depth credential-pattern scrubbing on the
  model's free-text answer.
- Config: `AuricConfig.ai*` fields (`core/kernel/config.ts`), mapped to
  `AssistantConfig` via `assistantConfigFromAuricConfig`.
- Tables: `ai_conversations`, `ai_messages` (`prisma/schema/assistant.prisma`),
  copied into each product's own migration history like every other Core
  baseline table (see `atlas/backend/prisma/schema/datasource.prisma`).

## 4. What it explicitly does NOT own

- **Any tool.** `get_matter`, `get_available_units`, `create_task` — all
  product code, calling the product's own existing services.
- **The system prompt.** Core calls `AssistantDomainConfig.buildSystemPrompt()`
  and never reads the string it returns.
- **Scope vocabulary.** What counts as "in scope" for a law firm vs. a real
  estate portfolio is product content, supplied via `SCOPE_GUARD_CONFIG`.
- **Permissions.** `use:assistant`, `ask:ai_conversation`, whatever a product
  calls the gate on reaching the assistant — defined and seeded by the
  product, checked by the product's own controller with the standard
  `PermissionGuard`. Core's `ToolRegistry` re-checks each tool's *own*
  permission the same way, but Core defines none of the permission strings.
- **The HTTP surface.** Each product has its own `AssistantController` at its
  own route, because the request/response DTOs, route path, and gating
  permission are product decisions.
- **`realestate_ai_insights`** (Atlas's dashboard insights banner) — a
  separate, unrelated feature that happens to live in the same product
  directory. Not part of this module.

## 5. Public surface

Plain injectable classes + tokens, re-exported from `core/index.ts` — there is
no `AssistantModule` Nest module, because the tool list, domain config, and
scope vocabulary must live in the *same* module scope as the classes that
consume them (Nest's injector is hierarchical: a token bound by the module that
imports a child module is not visible inside that child). Each product's own
`assistant.module.ts` lists `ToolRegistry`, `ScopeGuard`, `ConversationRepository`,
`AssistantService`, `OpenAiCompatibleClient` directly in its `providers` array —
imported classes, not re-wrapped — alongside its own tool/config bindings. This
is exactly the structure Mizan's `assistant.module.ts` already had; only the
import path for the generic pieces changed.

Tokens (`core/kernel/tokens.ts`): `AI_CLIENT`, `ASSISTANT_CONFIG`,
`ASSISTANT_TOOLS` (the product's `AssistantTool[]`), `ASSISTANT_DOMAIN_CONFIG`
(`{ domainKey, buildSystemPrompt }`), `SCOPE_GUARD_CONFIG`.

## 6. How a product wires it in

```ts
// <product>/assistant/assistant.module.ts
providers: [
  ReadTools, WriteTools, // product's own tool classes
  { provide: ASSISTANT_TOOLS, useFactory: (r, w) => [...r.tools(), ...w.tools()], inject: [ReadTools, WriteTools] },
  { provide: ASSISTANT_DOMAIN_CONFIG, useValue: { domainKey: "lawfirm", buildSystemPrompt } },
  { provide: SCOPE_GUARD_CONFIG, useValue: mizanScopeVocabulary },
  { provide: AI_CLIENT, useClass: OpenAiCompatibleClient },
  { provide: ASSISTANT_CONFIG, inject: [CONFIG], useFactory: assistantConfigFromAuricConfig },
  ToolRegistry, ScopeGuard, ConversationRepository, AssistantService,
],
controllers: [AssistantController], // product-owned, gates on its own permission
```

## 7. Dependencies & direction

Depends only on Core kernel primitives (`UNIT_OF_WORK`, `CLOCK`,
`PERMISSION_PROVIDER`, `ORGANIZATION_PROVIDER`, `USER_PROVIDER`,
`AUDIT_LOGGER`) — the same provider-interface boundary every other Core module
uses. Imports no domain module, and no domain module is imported by it.

## 8. Invariants

1. The LLM never receives direct database access — every tool is a thin
   adapter over an existing product service.
2. A tool call is authorized the same way an HTTP request to the equivalent
   endpoint would be: `IPermissionProvider.can()`, in the tenant, no
   role-string shortcuts.
3. `ToolRegistry.run()` never throws — every outcome is a `ToolResult`.
4. A conversation is private to its owning user within its tenant.
5. Core has zero identifiers, strings, or types naming a specific product's
   business entities.

## 9. Testing expectations

`core/tests/`: the generic pipeline proven with a fake domain (scripted tools,
a stub `AssistantDomainConfig`) — unknown tool rejected, permission-denied tool
rejected, cross-org and cross-user conversation isolation. Product-specific
security (its own tools against its own services) stays in each product's own
`tests/assistant-security.test.ts`.

## 10. When NOT to extend it

- To add a second AI provider before a project needs one.
- To move a product's tool, prompt, or scope vocabulary here "for consistency"
  — if it names a business entity, it isn't Core's.
- To give Core an opinion on what "in scope" means.
