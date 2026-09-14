import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import type { LeadSource, LeadStage, LeadStatus } from "./lead.domain.js";

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  stage: LeadStage;
  score: number;
  interestUnitId: string | null;
  interestText: string | null;
  valueEgp: number;
  agentId: string;
  probabilityPct: string | null;
  expectedCloseDate: string | null;
  lastActivityAt: Date;
  createdAt: Date;
}

export interface LeadFilter {
  status?: LeadStatus;
  stage?: LeadStage;
  agentId?: string;
  dealsOnly?: boolean;
}

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string | null;
  source: LeadSource;
  agentId: string;
  interestText?: string | null;
  valueEgp?: number;
}

@Injectable()
export class LeadsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: LeadFilter): Promise<LeadRow[]> {
    let q = realestateDb().selectFrom("realestate_leads").selectAll().where("organization_id", "=", this.org());
    if (filter.status) q = q.where("status", "=", filter.status);
    if (filter.stage) q = q.where("stage", "=", filter.stage);
    if (filter.agentId) q = q.where("agent_id", "=", filter.agentId);
    if (filter.dealsOnly) q = q.where((eb) => eb.or([eb("probability_pct", "is not", null), eb("expected_close_date", "is not", null)]));
    const rows = await q.orderBy("last_activity_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<LeadRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_leads")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateLeadInput): Promise<LeadRow> {
    const id = realestateId("led");
    await realestateDb()
      .insertInto("realestate_leads")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        source: input.source,
        status: "new",
        stage: "new",
        score: 0,
        interest_text: input.interestText ?? null,
        value_egp: input.valueEgp ?? 0,
        agent_id: input.agentId,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<{
      status: LeadStatus;
      stage: LeadStage;
      score: number;
      valueEgp: number;
      probabilityPct: number | null;
      expectedCloseDate: string | null;
      agentId: string;
    }>,
  ): Promise<LeadRow | null> {
    const set: Record<string, unknown> = { last_activity_at: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.stage !== undefined) set.stage = patch.stage;
    if (patch.score !== undefined) set.score = patch.score;
    if (patch.valueEgp !== undefined) set.value_egp = patch.valueEgp;
    if (patch.probabilityPct !== undefined) set.probability_pct = patch.probabilityPct === null ? null : String(patch.probabilityPct);
    if (patch.expectedCloseDate !== undefined) set.expected_close_date = patch.expectedCloseDate;
    if (patch.agentId !== undefined) set.agent_id = patch.agentId;
    await realestateDb()
      .updateTable("realestate_leads")
      .set(set)
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    source: LeadSource;
    status: LeadStatus;
    stage: LeadStage;
    score: number;
    interest_unit_id: string | null;
    interest_text: string | null;
    value_egp: number;
    agent_id: string;
    probability_pct: string | null;
    expected_close_date: string | Date | null;
    last_activity_at: Date | string;
    created_at: Date | string;
  }): LeadRow {
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      source: r.source,
      status: r.status,
      stage: r.stage,
      score: r.score,
      interestUnitId: r.interest_unit_id,
      interestText: r.interest_text,
      valueEgp: r.value_egp,
      agentId: r.agent_id,
      probabilityPct: r.probability_pct,
      expectedCloseDate: r.expected_close_date ? new Date(r.expected_close_date).toISOString().slice(0, 10) : null,
      lastActivityAt: new Date(r.last_activity_at),
      createdAt: new Date(r.created_at),
    };
  }
}
