import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type FollowupPriority = "high" | "medium" | "low";
export type FollowupStatus = "open" | "in-progress" | "overdue" | "done";

export interface FollowupRow {
  id: string;
  priority: FollowupPriority;
  leadId: string | null;
  customerId: string | null;
  reason: string;
  agentId: string;
  dueAt: Date;
  status: FollowupStatus;
}

export interface CreateFollowupInput {
  priority?: FollowupPriority;
  leadId?: string | null;
  customerId?: string | null;
  reason: string;
  agentId: string;
  dueAt: string;
}

@Injectable()
export class FollowupsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(agentId?: string, status?: FollowupStatus): Promise<FollowupRow[]> {
    let q = realestateDb().selectFrom("realestate_followups").selectAll().where("organization_id", "=", this.org());
    if (agentId) q = q.where("agent_id", "=", agentId);
    if (status) q = q.where("status", "=", status);
    const rows = await q.orderBy("due_at", "asc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<FollowupRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_followups")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateFollowupInput): Promise<FollowupRow> {
    const id = realestateId("fup");
    await realestateDb()
      .insertInto("realestate_followups")
      .values({
        id,
        organization_id: this.org(),
        priority: input.priority ?? "medium",
        lead_id: input.leadId ?? null,
        customer_id: input.customerId ?? null,
        reason: input.reason,
        agent_id: input.agentId,
        due_at: input.dueAt,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async updateStatus(id: string, status: FollowupStatus): Promise<FollowupRow | null> {
    await realestateDb()
      .updateTable("realestate_followups")
      .set({ status })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    priority: FollowupPriority;
    lead_id: string | null;
    customer_id: string | null;
    reason: string;
    agent_id: string;
    due_at: Date | string;
    status: FollowupStatus;
  }): FollowupRow {
    return {
      id: r.id,
      priority: r.priority,
      leadId: r.lead_id,
      customerId: r.customer_id,
      reason: r.reason,
      agentId: r.agent_id,
      dueAt: new Date(r.due_at),
      status: r.status,
    };
  }
}
