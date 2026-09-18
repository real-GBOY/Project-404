# AURIC Core Messaging + Atlas Conversation Intelligence

> Phase 1 audit + design (sections 1-9), then the as-built notes and architectural review (sections 10-12). Core owns **communication**; Atlas owns **real-estate
> intelligence**; the existing Atlas AI layer owns **understanding the conversation**.

## 1. Audit findings (what the repo actually has)

| Capability | State | Decision |
| --- | --- | --- |
| Socket.IO / WebSocket | **Absent.** Docs even say "no speculative WebSockets" (`core/notifications/README.md`, `docs/system-architecture.md` §279). This is the real need they were waiting for. | Add `socket.io` (server) + `socket.io-client` (web + tests). No `@nestjs/websockets` — a plain provider attached to Fastify's HTTP server keeps auth/tenancy explicit. |
| Redis / Valkey / BullMQ | **Absent.** Single-process systemd deploy on the VPS. | Not added. Socket.IO's in-memory adapter is correct for one process; broadcast sits behind a `RealtimeBroadcaster` seam so a Redis/Postgres adapter is a later drop-in. |
| Queue | Transactional **outbox** + DLQ + retries (`core/events`), DB-polling worker (2 s). | Reuse. AI analysis = an external outbox handler. Add `OutboxWorker.nudge()` so delivery after COMMIT is ~ms not ≤2 s. |
| Auth | Bearer JWT (HS256, 15 min), claims `sub/org/perms`; `JwtAuthGuard` + live `PermissionGuard`. | Socket handshake verifies the same JWT via `JWT_SERVICE`; per-event live RBAC via `IPermissionProvider`. |
| Tenancy | Ambient `RequestContext` (AsyncLocalStorage) → `SET LOCAL app.organization_id` per tx; RLS `FORCE`d on `auric_app`. | Each socket event runs in `withContext({userId, organizationId})` + `unitOfWork`. All new tables carry `organization_id` + RLS. |
| Files | Presigned upload → `files` row (`stored`), `FILE_STORAGE`. | Attachments reference `file_id`; download goes through a membership-checked messaging route. No new upload system. |
| Audit | `IAuditLogger.record` in the tx. | Conversation/member/message lifecycle audited (message bodies never). |
| AI | `core/assistant` (generic: `AiClient`, `ToolRegistry`, `ToolContext`, `AssistantTool`, scope guard) + `atlas/.../assistant` (22 tools, prompt) + `lead-intelligence/StructuredAi` (JSON completion + Zod + 1 repair retry) + `leadRequirementsSchema`. | **Extend, don't rebuild**: new messaging tools in Atlas's assistant; new Atlas `conversation-intelligence` module reuses `StructuredAi`, `AI_CLIENT`, `leadRequirementsSchema`. |
| Topology | Core source is shared by relative import; Mizan (`/prisma`) and Atlas (`atlas/backend/prisma`) are separate DBs. Core tables are defined in root `prisma/`, and each product copies the Core migration SQL. | Messaging tables → `prisma/schema/messaging.prisma` + root migration, copied verbatim into Atlas's migrations. Mizan gets the tables too and can consume messaging later. |

## 2. Architecture map

```
AURIC CORE  (core/messaging — generic, no real-estate)
  api/           REST: conversations, members, messages (cursor), sync, read, reactions, attachments
  application/   MessagingService (use cases, one tx each; also the IMessagingProvider)
  infrastructure/ repositories (Kysely, RLS)
  realtime/      RealtimeGateway (socket.io on Fastify http server; typing throttle + presence) · RealtimeBroadcaster
  events/        messaging.* domain events → outbox → broadcast subscribers
  contracts/     realtime-events.ts (types only; imported by web)

ATLAS  (atlas/backend/app/realestate)
  assistant/tools/conversation-tools.ts   get_conversation, get_conversation_messages, search_conversation_messages,
                                          get_conversation_insights, request_conversation_analysis, create_followup
  conversation-intelligence/              analyzer (StructuredAi) · state repo · outbox consumer · REST · apply-to-lead
  web: features/messages/                 conversation list · thread · composer · AI insights panel · socket client
```

## 3. Database (Core; prefix `messaging_`, ids `mcv_/mmsg_/…`; all RLS `tenant_isolation`)

- **messaging_conversations** — id, organization_id, type (`direct|group|channel`), title, subject_type/subject_id
  (generic "what is this about"; Atlas sets `lead`), created_by, created_at, updated_at, last_message_at, last_message_id,
  archived_at, metadata, `last_seq`, `last_change_seq` (per-conversation counters, bumped under row lock).
- **messaging_conversation_members** — conversation_id, user_id, organization_id, role (`owner|member`), joined_at, left_at,
  last_read_message_id, last_read_at, muted. PK (conversation_id, user_id); rejoin clears `left_at`.
- **messaging_messages** — id, conversation_id, organization_id, sender_id, body, message_type (`text|system`),
  client_message_id, reply_to_message_id, `seq` (creation order → history pagination), `change_seq`
  (bumped on create/edit/delete → resync cursor), created_at, updated_at, edited_at, deleted_at, metadata.
  Unique (conversation_id, seq); unique (conversation_id, sender_id, client_message_id) → **idempotency**.
- **messaging_message_attachments** — id, message_id, conversation_id, organization_id, file_id (→ `files`), created_at.
- **messaging_message_reactions** — message_id, user_id, emoji, organization_id (PK message+user+emoji).
- **Atlas** `realestate_conversation_ai_state` — conversation_id PK, organization_id, summary, key_facts, action_items,
  unresolved_questions, extracted_requirements, last_analyzed_change_seq, version, status, running_at, last_error, updated_at.

Why `seq`/`change_seq` under a conversation row lock: writers to one conversation serialize, so counters are commit-ordered
and a client can resync with `afterChangeSeq=N` without ever missing a row committed "out of order" (the classic identity-column gap).

## 4. Realtime

- Socket.IO server attached to Fastify's `http.Server` (path `/socket.io`, same CORS rules as HTTP). One connection per tab.
- **Handshake auth**: `auth.token` = access JWT → `JWT_SERVICE.verifyAccessToken`; must carry `org`; member of that org. Identity
  (`userId`, `organizationId`) is **only** taken from the token, never from payloads. Token `exp` is tracked: `auth:refresh`
  event swaps in a fresh token (same user+org) without reconnecting; an expired socket is disconnected with `auth.token_expired`
  and the client reconnects with a refreshed token.
- **Rooms** (server-authorized): `org:{orgId}` (presence), `user:{orgId}:{userId}` (personal: created/member events),
  `conversation:{id}`. Rooms mirror DB membership: auto-joined on connect from active memberships; `member_added` →
  `socketsJoin`, `member_removed` → `socketsLeave`. `messaging:conversation:join` re-verifies membership + permission; a client
  emitting join for a foreign conversation gets `messaging.conversation_not_found` (same answer as a missing one) and nothing is joined.
- **Client → server** (all acked `{ok:true,data}|{ok:false,error}`): `messaging:message:create`, `messaging:conversation:read`,
  `messaging:conversation:join|leave`, `messaging:typing:start|stop`, `auth:refresh`.
- **Server → client** (typed, versioned in `core/messaging/contracts/realtime-events.ts`):
  `messaging:conversation:{created,updated,member_added,member_removed,read}`, `messaging:message:{created,updated,deleted}`,
  `messaging:typing:{start,stop}`, `messaging:presence:update`. Atlas adds `atlas:conversation:ai_updated` through the generic
  broadcaster.
- **Typing** is memory-only: fan-out to the room minus the sender, server throttles per (user, conversation); never touches PG.
- **Read receipts** are a cursor (`last_read_message_id`, `last_read_at`), monotonic (never moves backwards), one row per member.
- **Presence**: in-memory refcount of sockets per (org, user); update on first connect / last disconnect; snapshot on connect.

## 5. Message flow (nothing is broadcast before COMMIT)

```
socket message:create ─▶ authn (token) ─▶ ctx(user, org) ─▶ live RBAC send:message ─▶ membership check
   ─▶ MessagingService.send()   [ONE tx]
        lock conversation row; dedupe by clientMessageId; insert message (+attachments);
        conversation.last_* update; audit; EventBus.publish(messaging.message.created)  → outbox row
      COMMIT
   ─▶ ack to sender (message appears immediately)
   ─▶ OutboxWorker.nudge() ─▶ external handlers (at-least-once, retried, DLQ):
        · messaging.broadcast  → socket room emit  (client dedupes by message id)
        · atlas.conversation_intelligence.analyze  → async AI (never in the request path)
```

## 6. Reconnect / resync

Socket.IO reconnect is transport-only. On every `connect` the client (1) re-authenticates with a current token (refresh first
if expired), (2) rooms are restored server-side from DB, (3) for each conversation it has cached it calls
`GET /api/conversations/:id/sync?afterChangeSeq=<lastSeen>` (creates + edits + deletes since), (4) reconciles by message id
(higher `change_seq` wins), (5) refetches the conversation list, (6) resumes live events. Pending sends are retried with the
same `clientMessageId` — the unique index makes the retry a no-op.

## 7. Atlas AI integration

- `conversation-intelligence` consumes `messaging.message.created` (external outbox handler, Atlas-registered). Only
  conversations with `subject_type ∈ {lead, customer}` (or manually requested) are analyzed.
- **Incremental**: state row holds summary/facts/actions/questions/requirements + `last_analyzed_change_seq`. Prompt =
  previous state + only new messages (capped). Output validated with Zod (`StructuredAi.completeJson`, 1 repair retry);
  `extractedRequirements` uses the existing `leadRequirementsSchema`. Bad output → state untouched, status `failed`, retried by the outbox.
- **Single-flight + coalescing**: an atomic claim (`running_at`) makes concurrent events no-ops; the running job loops once more
  if new messages landed meanwhile — LLM calls are bounded by analysis time, not message rate.
- **Data access**: analyzer and tools go through Core's `MessagingService`/provider contract — never SQL on `messaging_*`.
  Tools run through the existing `ToolRegistry` gate (parse → validate → RBAC → execute) as the requesting user: the service
  enforces conversation membership, so the AI sees exactly what the user sees. The background analyzer runs in the tenant's
  context (RLS on) without a user, and its output is only readable through membership-checked endpoints.
- **CRM**: nothing is silently mutated. Insights panel offers **Apply to lead** (`update:lead`, audited, reuses
  `LeadsRepository.setRequirements`) and **Create follow-up** (`create:followup`, reuses `FollowupsService`).

## 8. Security model

Tenant A never reaches Tenant B: (1) token org is authoritative; (2) RLS on every `messaging_*` table; (3) membership check in
the service (not only RLS) — a same-tenant non-member is refused too; (4) socket rooms are joined only after that check;
(5) attachment download = membership check → `FILE_STORAGE`; attachments must be `stored` files owned by the sender in the
same tenant. Permissions (Core seeds; Atlas roles grant): `read:conversation`, `create:conversation`, `manage:conversation`,
`send:message`, `moderate:message` (delete others'). Atlas: `read:conversation_insight`, `apply:conversation_insight`.

## 9. Known limits (deliberate)

Single-process fan-out (documented seam for scale-out); presence is org-wide-visible; message search is `ILIKE` behind a
`search()` method so Postgres FTS can replace it; AI attachment understanding is out of scope for v1 (attachments are passed to
the model as filename/type metadata only).

## 10. As built — where the implementation refined the design

- **Two-hop AI trigger.** `messaging.message.*` has an *in-process* Atlas subscriber that only writes an
  `atlas.conversation.analysis_requested` outbox row (pure DB, inside the sender's tx); the analyzer is an
  *external* handler on that row. Result: the LLM call has its own retries/backoff/DLQ and an outage can never
  re-deliver Core's realtime broadcast row.
- **Read receipts skip the outbox.** The cursor is persisted; the `conversation:read` broadcast goes out directly
  after commit (a lost event self-heals on the next fetch). Everything else goes through the outbox.
- **Leaf module to avoid a cycle.** `ConversationInsightsStoreModule` (state repo, reader, analysis requester) is
  AI-free so `AssistantModule` (Copilot tools) and `ConversationIntelligenceModule` (analyzer, which needs
  `AssistantModule` for the AI client) share it without a module cycle. `StructuredAi` is now exported from
  `LeadIntelligenceModule` and reused — no second AI client.
- **`realestate_conversation_ai_state` also tracks `last_analyzed_seq`** (creation order) next to
  `last_analyzed_change_seq`, so a reaction-only change advances the cursor without spending an LLM call.
- **History responses carry `lastChangeSeq`** (read before the messages, so it can only lag) — the cursor a client
  hands to `sync` after loading.
- **The web copies the wire contract** (`atlas/web/src/features/messages/contracts/`), guarded by
  `contracts.sync.test.ts`, because atlas/web is a separate package that cannot import backend source.
- **Web transport is WebSocket-only** unless `VITE_REALTIME_POLLING_FALLBACK=true`.

## 11. Bugs the tests caught (kept as regression tests)

1. A delayed `member_added` / `conversation.created` outbox event could re-join a socket for a member removed in the
   meantime → subscribers re-verify live membership; the gateway re-reads membership after joining on connect and on `join`.
2. Reconnect resync computed its result from a stale snapshot and overwrote a message the socket delivered while the
   request was in flight → `resyncThread` now applies each page to the *current* cache via a functional update.

## 12. Architectural review (Phase 8)

| Requirement | Verdict | Evidence |
| --- | --- | --- |
| Core stays generic | yes | vocabulary guard test over `core/messaging`; only `subjectType`/`subjectId`/`metadata` link out |
| Atlas AI stays Atlas-specific | yes | prompts, schema, state table, tools all under `atlas/backend/app/realestate` |
| Realtime is WebSocket | yes | Socket.IO on the app's HTTP server; client WebSocket-only by default; 20 ms send→receive on the real server |
| No polling | yes | no timer fetches anywhere; queries use `staleTime: Infinity` and are written by events; server delivery is nudged post-commit |
| No synchronous LLM | yes | send path makes zero AI calls (asserted); analysis runs in the outbox worker |
| No direct AI DB access | yes | analyzer + tools use `IMessagingProvider`; architecture test forbids `messaging_*` queries in Atlas AI code |
| Tenant isolation | yes | RLS on every table, membership in the service, rooms authorized server-side; cross-tenant read/send/join/download/AI-tool tests |
| Permission boundaries | yes | tools go through `ToolRegistry` (RBAC gate) as the user; "apply" needs `apply:conversation_insight` **and** `update:lead`/`create:followup` |
| Reconnect correctness | yes | resync by `changeSeq`, idempotent resend by `clientMessageId`, membership restored from the DB, token refresh/expiry handled |
| No duplicated infrastructure | yes | reused outbox, files, auth/JWT, RBAC, RLS, audit, AI client; new dependency: `socket.io` (+ `socket.io-client`) only |

Not verified here: behaviour behind a real nginx (config documented in `docs/atlas-deployment.md`), a live LLM
(tests use a scripted provider; the smoke run had AI unconfigured), and multi-process fan-out (out of scope, seam documented).
