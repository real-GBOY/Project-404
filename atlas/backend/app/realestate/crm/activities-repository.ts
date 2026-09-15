import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import { combinedRelevance } from "@atlas/realestate/shared/search.js";

export type ActivityType = "call" | "meeting" | "viewing" | "email" | "note" | "whatsapp";

export interface ActivityFilter {
  relatedType?: string;
  relatedId?: string;
  type?: ActivityType;
  agentId?: string;
  /** Free-text search across subject/outcome, ranked by relevance. */
  q?: string;
}

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

  async list(filter: ActivityFilter = {}): Promise<ActivityRow[]> {
    let query = realestateDb().selectFrom("realestate_activities").selectAll().where("organization_id", "=", this.org());
    if (filter.relatedType) query = query.where("related_type", "=", filter.relatedType);
    if (filter.relatedId) query = query.where("related_id", "=", filter.relatedId);
    if (filter.type) query = query.where("type", "=", filter.type);
    if (filter.agentId) query = query.where("agent_id", "=", filter.agentId);

    const term = filter.q?.trim();
    if (term) {
      const score = combinedRelevance([{ column: "subject" }, { column: "outcome", weight: 0.7 }], term);
      const rows = await query
        .select(score.as("relevance_score"))
        .where(score, ">", 0)
        .orderBy("relevance_score", "desc")
        .orderBy("occurred_at", "desc")
        .execute();
      return rows.map((r) => this.toRow(r));
    }

    const rows = await query.orderBy("occurred_at", "desc").execute();
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
