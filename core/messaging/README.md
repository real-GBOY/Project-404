# `core/messaging` — real-time conversations

Design + rationale: [`docs/messaging.md`](../../docs/messaging.md). This file is the
module's contract and its rules.

## 1. What it is

Generic, tenant-safe **communication**: conversations, members, messages (replies,
edits, deletes, reactions, attachment *references*), read cursors, typing
indicators and presence — delivered in real time over Socket.IO and readable as
history over REST.

## 2. What it deliberately is not

It knows nothing about any product. No leads, customers, properties, prompts or
CRM. A product attaches meaning through `subjectType`/`subjectId` (+ `metadata`)
and reads conversations through the membership-checked `MESSAGING_PROVIDER`
contract. (`atlas/backend/app/realestate/conversation-intelligence` is the first
consumer; a Mizan matter chat would be another.) A test in
`atlas/.../conversation-intelligence/tests` fails if real-estate vocabulary leaks
into this folder.

## 3. Using it

```ts
@Module({ imports: [/* …Core modules… */ MessagingModule] })
export class AppModule {}
```

- REST: `GET/POST /api/conversations`, `…/:id/messages` (cursor history),
  `…/:id/sync` (reconnect resync), `…/:id/read`, `…/:id/attachments/:attachmentId`.
- Realtime: connect Socket.IO to the API origin with `auth: { token: <access JWT> }`.
  Wait for `realtime:ready`. Commands/events are typed in
  `contracts/realtime-events.ts` (types-only — a web client can copy it; atlas/web
  does, guarded by a sync test).
- Products read through `MESSAGING_PROVIDER` and emit their own namespaced events
  to the same authorized rooms through `REALTIME_BROADCASTER`.
- Seeded permissions: `read:conversation`, `create:conversation`, `send:message`,
  `moderate:message`. **Membership** is what opens a conversation; permissions are the
  coarse gate on top.

## 4. The rules (each one is enforced by a test)

1. **Identity comes from the token** (JWT verified in the handshake / HTTP guard).
   `senderId`, `organizationId` and permissions in a payload are ignored.
2. **Tenant + membership on every path.** RLS on all `messaging_*` tables is the
   backstop; the service additionally requires active membership. Another tenant's
   conversation and a same-tenant non-member's both answer "not found" — existence
   is never an oracle.
3. **Rooms mirror the database.** `conversation:{id}` is joined only after a live
   membership check; a client's `join` grants nothing by itself. Membership changes
   join/evict live sockets; delayed events re-check membership before touching a
   room (a removed member is never re-joined by a stale "added" event).
4. **Nothing is broadcast before COMMIT.** Message/conversation/member events go
   through the transactional outbox; `OutboxWorker.nudge()` (post-commit) makes
   delivery milliseconds, not a poll interval. Read receipts and typing are the
   exceptions: read is a persisted cursor broadcast directly after commit (a lost
   event self-heals on the next fetch); typing is memory-only and never touches
   PostgreSQL.
5. **Idempotent send.** `(conversation, sender, clientMessageId)` is unique; a retry
   returns the original message and emits nothing.
6. **Ordered and resyncable.** Per-conversation `seq` (creation order → history
   cursor) and `changeSeq` (create/edit/delete/reaction → resync cursor) are bumped
   under the conversation row lock, so they are commit-ordered. Reconnect =
   `GET …/sync?afterChangeSeq=` — Socket.IO reconnecting alone is not trusted.
7. **Read state is a cursor** (`last_read_message_id`, monotonic), never a row per
   user × message.
8. **Attachments are Core files.** A message stores `file_id` + a display snapshot;
   the file must be `stored`, in the tenant, uploaded by the sender. Bytes never
   cross the socket. Download is membership-checked, then `FILE_STORAGE`.
9. **Deleted means gone.** Delete wipes the body and the attachment references.
10. **Audit records shape, never message bodies.**

## 5. Layout

```
api/            REST controller
application/    MessagingService (use cases; also the IMessagingProvider)
contracts/      messaging-types.ts, realtime-events.ts  (types + constants only)
events/         messaging.* domain events (outbox)
infrastructure/ MessagingRepository (Kysely; RLS-scoped)
permissions/    the four coarse permissions
realtime/       RealtimeGateway (auth, rooms, commands), RealtimeBroadcaster,
                PresenceRegistry, broadcast-subscribers
validation/     Zod schemas shared by REST and socket commands
tests/          messaging.integration (service) · realtime.integration (real sockets)
```

## 6. Known limits

Single-process fan-out and presence (in-memory adapter — swap `RealtimeBroadcaster`
and `PresenceRegistry` behind their existing seams for multi-node); message search
is `ILIKE` behind `MessagingRepository.searchMessages`; the inbox loads the first
100 conversations (the API paginates; the UI does not yet); no end-to-end encryption.
