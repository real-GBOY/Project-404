import { currentExecutor } from "../../kernel/db/db.js";
import { newId } from "../../kernel/id.js";
import type { AuditEntry } from "../../contracts/index.js";
import { getContext } from "../../kernel/logging/context.js";

export interface AuditRecord {
  id: string;
  actorId: string | null;
  actorType: "user" | "system";
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown> | null;
  correlationId: string | null;
  createdAt: Date;
}

export interface AuditQuery {
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string; // id to page before
}

export class AuditRepository {
  async append(entry: AuditEntry): Promise<void> {
    await currentExecutor()
      .insertInto("audit_logs")
      .values({
        id: newId("aud"),
        actor_id: entry.actorId,
        actor_type: entry.actorType ?? (entry.actorId ? "user" : "system"),
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        metadata: entry.metadata ?? null,
        correlation_id: getContext()?.correlationId ?? null,
      })
      .execute();
  }

  async query(q: AuditQuery): Promise<AuditRecord[]> {
    let builder = currentExecutor().selectFrom("audit_logs").selectAll();

    if (q.actorId) builder = builder.where("actor_id", "=", q.actorId);
    if (q.resourceType) builder = builder.where("resource_type", "=", q.resourceType);
    if (q.resourceId) builder = builder.where("resource_id", "=", q.resourceId);
    if (q.action) builder = builder.where("action", "=", q.action);
    if (q.from) builder = builder.where("created_at", ">=", q.from);
    if (q.to) builder = builder.where("created_at", "<=", q.to);
    if (q.cursor) builder = builder.where("id", "<", q.cursor);

    const rows = await builder
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(Math.min(q.limit ?? 50, 200))
      .execute();

    return rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorType: r.actor_type as "user" | "system",
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      before: r.before,
      after: r.after,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      correlationId: r.correlation_id,
      createdAt: new Date(r.created_at),
    }));
  }
}
