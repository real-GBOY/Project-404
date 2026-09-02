# `core/observability` — health, readiness, error tracking

## 1. What it is

Operational visibility (Plan §7.12, §6.2): the `/api/health` (liveness) and
`/api/health/ready` (readiness) endpoints, and the `ERROR_TRACKER` hook that
unhandled errors are reported through. Structured logging + correlation ids live
in `core/kernel/logging` and are threaded by `core/http`'s request-context
middleware.

## 2. Why it exists

A load balancer needs a liveness probe; an orchestrator needs a readiness probe
that actually reflects whether the process can serve traffic — including the fact
that **the outbox worker can fail quietly while events pile up**.

## 3. What problem it solves

- Deploys/rollbacks gated on a real readiness signal, not just "the port is
  open".
- A single place errors are reported, so wiring Sentry/Datadog later is one
  adapter swap, not a code sweep.
- The silent-outbox-failure class of bug becomes a visible `503`.

## 4. Responsibilities

- `HealthController`:
  - `GET /api/health` → always `200 { status: "ok", version, time }` if the
    process is up.
  - `GET /api/health/ready` → `200 { status: "ready", checks }` when the DB
    responds **and** the outbox worker is running, error-free, not backed up, and
    has no dead-lettered messages; `503 { status: "degraded", checks }`
    otherwise. The backlog check spans **all** tenants and runs on the system
    connection.
- `errors/error-tracker.ts` — `loggingErrorTracker` (`ErrorTracker`), bound to
  `ERROR_TRACKER` by `KernelModule`; the default logs, a real tracker replaces it.

## 5. What it owns

The health/readiness contract and the error-tracker interface + default
implementation.

## 6. What it explicitly does NOT own

- **Metrics / tracing backends** (Prometheus, OpenTelemetry exporters) — hooks
  exist; exporters are added when there is somewhere to send them.
- **The logger itself** — `pino` + `moduleLogger` are in `core/kernel/logging`.
- **Request-context propagation** — the middleware that sets the correlation id
  is in `core/http`.
- Alerting rules, dashboards, uptime monitoring — infra, not code.

## 7. Public surface

- `HealthController` (wired by the composition root; both routes are **public** —
  no guards).
- Token `ERROR_TRACKER` (`ErrorTracker`), overridable.

## 8. How to use

Probes:

```bash
curl -f localhost:3000/api/health          # liveness  → 0/1 exit for k8s
curl -f localhost:3000/api/health/ready     # readiness → 503 blocks the rollout
```

Report an error from anywhere:

```ts
constructor(@Inject(ERROR_TRACKER) private readonly errors: ErrorTracker) {}
this.errors.capture(err, { where: "outbox-worker", messageId });
```

## 9. Dependencies & direction

`HealthController` reads `OutboxRepository` + `OutboxWorker` (`core/events`) and
the DB (`core/kernel`). Nothing depends on observability's internals; everything
may inject `ERROR_TRACKER`.

## 10. Invariants

1. `/health` never touches the DB — it must answer even when everything
   downstream is broken.
2. `/health/ready` returns `503` if the DB is unreachable, or the outbox worker
   is stopped / erroring / badly backed up / has any dead-lettered message.
3. Both routes are unauthenticated.
4. The readiness backlog is read across all tenants on the system connection (it
   is an operator concern, not a tenant one).

## 11. Example — the readiness checks

```json
{
  "status": "degraded",
  "checks": {
    "database":      { "ok": true },
    "outboxWorker":  { "ok": false, "detail": "worker stopped" },
    "outboxBacklog": { "ok": true,  "detail": { "pending": 3 } },
    "deadLetter":    { "ok": false, "detail": { "count": 1 } }
  }
}
```

## 12. Testing expectations

`core/tests/`: `/health` is `200` with the DB down; `/health/ready` is `503`
when the worker is stopped and when a message is dead-lettered; `200` when
healthy; neither route requires a token.

## 13. When NOT to extend it

- To add a metrics exporter with no collector to receive it.
- To put auth on the probes.
- To reimplement logging here — it lives in the kernel.
