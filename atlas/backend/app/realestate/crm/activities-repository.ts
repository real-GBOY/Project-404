import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type ActivityType = "call" | "meeting" | "viewing" | "email" | "note" | "whatsapp";

export interface ActivityRow {
  id: string;
  type: ActivityType;
  subject: string;
  relatedType: string | null;
  relatedId: string | null;
  agentId: string;
  outcome: string | null;
  occurredAt: Date;
}

export interface CreateActivityInput {
  type: ActivityType;
  subject: string;
  relatedType?: string | null;
  relatedId?: string | null;
  agentId: string;
  outcome?: string | null;
}

@Injectable()
export class ActivitiesRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(relatedType?: string, relatedId?: string): Promise<ActivityRow[]> {
    let q = realestateDb().selectFrom("realestate_activities").selectAll().where("organization_id", "=", this.org());
    if (relatedType) q = q.where("related_type", "=", relatedType);
    if (relatedId) q = q.where("related_id", "=", relatedId);
    const rows = await q.orderBy("occurred_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async create(input: CreateActivityInput): Promise<ActivityRow> {
    const id = realestateId("act");
    await realestateDb()
      .insertInto("realestate_activities")
      .values({
        id,
        organization_id: this.org(),
        type: input.type,
        subject: input.subject,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
        agent_id: input.agentId,
        outcome: input.outcome ?? null,
      })
      .execute();
    const row = await realestateDb()
      .selectFrom("realestate_activities")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return this.toRow(row);
  }

  private toRow(r: {
    id: string;
    type: ActivityType;
    subject: string;
    related_type: string | null;
    related_id: string | null;
    agent_id: string;
    outcome: string | null;
    occurred_at: Date | string;
  }): ActivityRow {
    return {
      id: r.id,
      type: r.type,
      subject: r.subject,
      relatedType: r.related_type,
      relatedId: r.related_id,
      agentId: r.agent_id,
      outcome: r.outcome,
      occurredAt: new Date(r.occurred_at),
    };
  }
}
