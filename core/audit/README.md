# `core/audit` — the audit trail

## 1. What it is

An append-only record of who did what to which resource (Plan §7.7). Exposes
`IAuditLogger.record(entry)`; every sensitive use case writes one line, inside
its own transaction. The trail is queryable via `GET /api/audit-logs` and its
immutability is DB-enforced.

## 2. Why it exists

Regulated / professional applications must be able to answer "who changed this,
and when". That requirement is universal; the implementation (immutable table,
actor + action + before/after, correlation id) is always the same.

## 3. What problem it solves

- One tamper-evident trail instead of scattered `console.log`s.
- Audit that is part of the **same transaction** as the change — no "the change
  committed but the audit line didn't".
- A queryable surface for a "Security & audit" settings screen.

## 4. Responsibilities

- `AuditLogger.record(entry)` (`IAuditLogger`) — append one entry.
- `AuditRepository` — the `audit_entries` table; query with filters + paging.
- `AuditController` — `GET /api/audit-logs` (permission-gated).
- Carry the correlation id from the request context onto every entry.

## 5. What it owns

The `audit_entries` table (`prisma/schema/audit.prisma`) — `actorId`,
`actorType`, `action`, `resourceType`, `resourceId`, `before`, `after`,
`metadata`, `at`, `correlationId`, `organizationId`. The `AuditEntry` input
shape. The DB-level immutability (no `UPDATE`/`DELETE` — enforced by trigger /
revoked grants).

## 6. What it explicitly does NOT own

- **The activity feed** a product shows users. Mizan's `lawfirm_activity_entries`
  is a separate, rendered projection fed by in-process event subscribers — not
  this trail (decision #11; extract `IAuditReader` only on rule-of-three).
- **Deciding what is sensitive** — each use case chooses to call `record()`.
- **Retention / archival policy** — added when a real requirement (legal hold,
  GDPR) appears.
- Application logs / metrics — that is `core/observability`.

## 7. Public surface

- `AuditModule` — exports token `AUDIT_LOGGER` (`IAuditLogger`) and
  `AuditRepository`.
- HTTP: `GET /api/audit-logs?q&resourceType&actorId&from&to&cursor`.

## 8. How to use

```ts
await this.uow.transaction(async () => {
  await this.repo.update(invoice);                 // the change
  await this.audit.record({                        // the audit line — same transaction
    actorId, actorType: "user",
    action: "invoice.voided",
    resourceType: "invoice", resourceId: invoice.id,
    before: { status: "sent" }, after: { status: "void" },
  });
  await this.events.publish(invoiceVoided({ invoiceId: invoice.id }));
});
```

## 9. Dependencies & direction

Depends only on `kernel`. **Almost every module imports `AuditModule`.** Audit
imports no feature module.

## 10. Invariants

1. `record()` is called **inside** the use-case transaction — audit and change
   commit or roll back together.
2. The table is append-only; there is no code path (and no DB grant) to modify or
   delete an entry.
3. `action` follows `resource.verb` (`invoice.voided`, `matter.closed`).
4. Entries carry the request correlation id, so `request → logs → db → audit`
   join up.
5. Entries are tenant-scoped (`organization_id`, RLS).

## 11. Example — the two "histories"

```
core/audit  audit_entries              immutable, security/compliance, IAuditLogger
Mizan       lawfirm_activity_entries   rendered feed for users, fed by event subscribers
```

Do not conflate them. The audit trail is not a feature; the activity feed is.

## 12. Testing expectations

`core/audit/tests/` + `core/tests/`: a rolled-back use case leaves **no** audit
entry; an `UPDATE`/`DELETE` on `audit_entries` fails; query filters + paging;
**tenant A cannot read tenant B's entries**; correlation id round-trips.

## 13. When NOT to extend it

- To power a user-facing activity feed — build a projection in the product.
- To make entries editable/deletable — that defeats the point.
- To add retention automation before there is a policy to implement.
