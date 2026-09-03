import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";

export interface ActivityEntry {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  at: Date;
}

export interface RecordActivityInput {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  at?: Date;
}

/**
 * The product activity feed (`lawfirm_activity_entries`). Distinct from Core's
 * tamper-evident `audit_logs`: this is the human-readable "what happened on
 * this matter / client" timeline the UI renders. Every feature service calls
 * `record()` inside its own transaction.
 */
@Injectable()
export class ActivityRepository {
  async record(input: RecordActivityInput): Promise<void> {
    await currentExecutor()
      .insertInto("lawfirm_activity_entries")
      .values({
        id: lawfirmId("act"),
        organization_id: requireOrganizationId(),
        actor_id: input.actorId,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId,
        target_label: input.targetLabel,
        ...(input.at ? { at: input.at } : {}),
      })
      .execute();
  }

  /** Entries whose target is any of the given `type:id` pairs, newest first. */
  async byTargets(targets: Array<{ type: string; id: string }>): Promise<ActivityEntry[]> {
    if (targets.length === 0) return [];
    let q = currentExecutor().selectFrom("lawfirm_activity_entries").selectAll();
    q = q.where((eb) =>
      eb.or(
        targets.map((t) => eb.and([eb("target_type", "=", t.type), eb("target_id", "=", t.id)])),
      ),
    );
    const rows = await q.orderBy("at", "desc").execute();
    return rows.map(this.toEntry);
  }

  async recent(limit = 20): Promise<ActivityEntry[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_activity_entries")
      .selectAll()
      .orderBy("at", "desc")
      .limit(limit)
      .execute();
    return rows.map(this.toEntry);
  }

  async search(
    q: string | undefined,
    limit = 50,
  ): Promise<{ items: ActivityEntry[]; total: number }> {
    let query = currentExecutor().selectFrom("lawfirm_activity_entries").selectAll();
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          eb(eb.fn("lower", ["action"]), "like", like),
          eb(eb.fn("lower", ["target_label"]), "like", like),
          eb(eb.fn("lower", ["target_type"]), "like", like),
        ]),
      );
    }
    const rows = await query.orderBy("at", "desc").limit(limit).execute();
    return { items: rows.map(this.toEntry), total: rows.length };
  }

  private toEntry(row: {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    target_label: string;
    at: Date | string;
  }): ActivityEntry {
    return {
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      targetLabel: row.target_label,
      at: new Date(row.at),
    };
  }
}
