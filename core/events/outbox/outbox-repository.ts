import { currentExecutor } from "../../kernel/db/db.js";
import { newId } from "../../kernel/id.js";
import type { DomainEvent } from "../../contracts/domain-event.js";
import type { Clock } from "../../kernel/clock.js";
import { currentOrganizationId } from "../../kernel/tenant.js";

export interface OutboxRow {
  id: string;
  organization_id: string | null;
  event_name: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
}

/**
 * Owns the `outbox_messages` and `dead_letter_messages` tables. `enqueue`
 * runs on the ambient transaction (currentExecutor) so the event row is
 * written atomically with the business data. Everything else is called by the
 * worker on its own connection.
 */
export class OutboxRepository {
  constructor(
    private readonly clock: Clock,
    private readonly defaultMaxAttempts: number,
  ) {}

  async enqueue(event: DomainEvent): Promise<void> {
    await currentExecutor()
      .insertInto("outbox_messages")
      .values({
        id: newId("obx"),
        organization_id: currentOrganizationId(),
        event_name: event.name,
        payload: {
          __version: event.version,
          __occurredAt: (event.occurredAt ?? this.clock.now()).toISOString(),
          __correlationId: event.correlationId ?? null,
          ...event.payload,
        },
        status: "pending",
        max_attempts: this.defaultMaxAttempts,
        next_attempt_at: this.clock.now(),
      })
      .execute();
  }

  /**
   * Atomically claim up to `limit` due messages: SKIP LOCKED means many
   * workers (or many ticks) never fight over the same row.
   */
  async claimDue(limit: number): Promise<OutboxRow[]> {
    const now = this.clock.now();
    const rows = await currentExecutor()
      .updateTable("outbox_messages")
      .set({ status: "processing", locked_at: now })
      .where(
        "id",
        "in",
        (eb) =>
          eb
            .selectFrom("outbox_messages")
            .select("id")
            .where("status", "=", "pending")
            .where("next_attempt_at", "<=", now)
            .orderBy("next_attempt_at", "asc")
            .limit(limit)
            .forUpdate()
            .skipLocked(),
      )
      .returning([
        "id",
        "organization_id",
        "event_name",
        "payload",
        "attempts",
        "max_attempts",
        "last_error",
      ])
      .execute();

    return rows.map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      event_name: r.event_name,
      payload: r.payload as Record<string, unknown>,
      attempts: r.attempts,
      max_attempts: r.max_attempts,
      last_error: r.last_error,
    }));
  }

  async markDelivered(id: string): Promise<void> {
    await currentExecutor()
      .updateTable("outbox_messages")
      .set({ status: "delivered", delivered_at: this.clock.now(), locked_at: null })
      .where("id", "=", id)
      .execute();
  }

  /** Transient failure: back to pending with exponential backoff. */
  async reschedule(id: string, attempts: number, error: string): Promise<void> {
    const backoffMs = Math.min(2 ** attempts * 1000, 60 * 60 * 1000);
    await currentExecutor()
      .updateTable("outbox_messages")
      .set({
        status: "pending",
        attempts,
        last_error: error.slice(0, 4000),
        locked_at: null,
        next_attempt_at: new Date(this.clock.now().getTime() + backoffMs),
      })
      .where("id", "=", id)
      .execute();
  }

  /** Terminal failure: park in the DLQ, mark the outbox row failed. */
  async deadLetter(row: OutboxRow, attempts: number, error: string): Promise<void> {
    const exec = currentExecutor();
    const existing = await exec
      .selectFrom("outbox_messages")
      .select("last_error")
      .where("id", "=", row.id)
      .executeTakeFirst();

    const history: Array<{ at: string; error: string }> = [];
    if (existing?.last_error) history.push({ at: "prior", error: existing.last_error });
    history.push({ at: this.clock.now().toISOString(), error });

    await exec
      .insertInto("dead_letter_messages")
      .values({
        id: newId("dlq"),
        organization_id: row.organization_id,
        outbox_id: row.id,
        event_name: row.event_name,
        payload: row.payload,
        attempts,
        last_error: error.slice(0, 4000),
        retry_history: JSON.stringify(history),
      })
      .execute();

    await exec
      .updateTable("outbox_messages")
      .set({ status: "failed", attempts, last_error: error.slice(0, 4000), locked_at: null })
      .where("id", "=", row.id)
      .execute();
  }

  /** Ops helper: how many messages are stuck. Feeds the health check (§6.2). */
  async stats(): Promise<{ pending: number; processing: number; failed: number; deadLettered: number }> {
    const exec = currentExecutor();
    const byStatus = await exec
      .selectFrom("outbox_messages")
      .select(["status", (eb) => eb.fn.countAll<number>().as("count")])
      .groupBy("status")
      .execute();
    const dlq = await exec
      .selectFrom("dead_letter_messages")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("replayed_at", "is", null)
      .executeTakeFirst();

    const get = (s: string) => Number(byStatus.find((r) => r.status === s)?.count ?? 0);
    return {
      pending: get("pending"),
      processing: get("processing"),
      failed: get("failed"),
      deadLettered: Number(dlq?.count ?? 0),
    };
  }

  /** Recover rows a crashed worker left mid-flight. */
  async releaseStale(olderThanMs: number): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - olderThanMs);
    const res = await currentExecutor()
      .updateTable("outbox_messages")
      .set({ status: "pending", locked_at: null })
      .where("status", "=", "processing")
      .where("locked_at", "<", cutoff)
      .executeTakeFirst();
    return Number(res.numUpdatedRows ?? 0);
  }
}
