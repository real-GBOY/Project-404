# `core/events` — in-process bus + transactional outbox

## 1. What it is

The event system (Plan §6): an in-process `EventBus` for handlers that only
touch the database, plus a **transactional outbox** (`outbox_messages` table) + a
polling `OutboxWorker` + a dead-letter queue for handlers that cause **external**
side effects (send an email, call an API). `EventRegistry` is where modules
register their subscribers.

## 2. Why it exists

Modules must react to each other's events without importing each other
(`HearingScheduled → notify the lead lawyer`), and external side effects must
happen **exactly once**, only if the triggering transaction committed.

## 3. What problem it solves

- **Decoupling**: a publisher lists what happened; it does not know who listens.
- **The dual-write problem**: writing a row *and* sending an email is not atomic.
  The outbox makes the "send an email" a row in the *same* transaction; the
  worker delivers it afterward, with retries and a DLQ.
- **DB-only reactions stay synchronous**: no need to pay outbox latency for
  handlers that just write another row.

## 4. Responsibilities

- `EventBus.publish(event)` — dispatch to in-process subscribers **and** enqueue
  an outbox row, all inside the caller's transaction.
- `EventRegistry` — hold `(eventName → handler[])` registrations.
- `OutboxRepository` — claim / mark-done / mark-failed / dead-letter rows.
- `OutboxWorker` — `tick()` loop: claim a batch, run external handlers, retry
  with backoff, move exhausted messages to the DLQ. `WORKER_AUTOSTART` gates
  auto-start (off in tests, which drive `tick()`).
- Expose worker health to `/api/health/ready` (via `observability`).

## 5. What it owns

The `outbox_messages` table and its lifecycle (`pending → claimed → done |
failed → dead`). The `DomainEvent` envelope shape (name, payload, occurredAt,
correlationId).

## 6. What it explicitly does NOT own

- **Transactions** — the bus never opens one. The use case does, and calls
  `publish()` inside it (Plan §4, §6.1).
- The *meaning* of any event — publishers define event names/payloads via
  `defineEvent`.
- Delivery mechanisms for side effects — the email channel is `core/notifications`;
  an HTTP call is the subscribing module's infrastructure.
- A cross-process message broker (Kafka/RabbitMQ). In-process only until a real
  requirement forces otherwise.

## 7. Public surface

- `EventsModule`, `EventRegistry`, token `EVENT_BUS` (`IEventBus`).
- `DomainEvent`, `defineEvent` (from `core/contracts`).
- `OutboxWorker.tick()` / `.start()` / `.stop()` — for bootstrap and tests.

## 8. How to use

**Publish** (in a use case, inside the transaction):

```ts
await this.uow.transaction(async () => {
  await this.repo.insert(matter);
  await this.audit.record({ /* … */ });
  await this.events.publish(matterOpened({ matterId: matter.id, organizationId }));
});
```

**Subscribe** (in the subscribing module's `OnModuleInit`):

```ts
onModuleInit() {
  this.registry.on("hearing.scheduled", async (e) => {
    await this.notify.send({ userId: e.leadLawyerId, templateKey: "hearing.scheduled", data: e });
  });
}
```

DB-only handler → runs in the publisher's transaction. Handler with an external
call → register it as an **outbox** handler so the worker runs it after commit.

## 9. Dependencies & direction

Depends on `kernel` (unit-of-work, clock, logging) + `contracts`. `AuditModule`
and every feature module depend on `EventsModule`. Events depends on no feature
module.

## 10. Invariants

1. `publish()` is called **inside** the use-case transaction; if the transaction
   rolls back, nothing was published and no outbox row exists.
2. In-process handlers must be DB-only. Anything external goes through the outbox.
3. External delivery is **at-least-once**; handlers must be idempotent (Mizan's
   reminder scheduler keys on `entity:id:offset`, for example).
4. A message that exhausts its retries goes to the DLQ and trips
   `/health/ready` — it never disappears silently.
5. Event names are stable identifiers (`matter.opened`) — renaming one is a
   breaking change for every subscriber.

## 11. Example — a resettable test

```ts
const bus = moduleRef.get<IEventBus>(EVENT_BUS);
await useCase.run(input);          // publishes inside its own transaction
await worker.tick();               // deliver outbox side effects now
expect(sentEmails).toHaveLength(1);
await worker.tick();               // idempotent — still 1
```

## 12. Testing expectations

`core/events/tests/`: publish-inside-rollback leaves no outbox row; the worker
delivers once, retries on failure, dead-letters after N attempts; two `tick()`s
do not double-deliver; the registry dispatches to all handlers for a name.

## 13. When NOT to extend it

- To add a broker (Kafka/SQS) speculatively — in-process + outbox is the design
  until horizontal scale is a real constraint.
- To make the bus open transactions — that inverts the ownership rule.
- To route *commands* (do this) through it — this is for *events* (this
  happened).
