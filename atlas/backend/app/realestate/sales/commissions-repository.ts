import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type CommissionStatus = "pending" | "approved" | "paid";

export interface CommissionRow {
  id: string;
  agentId: string;
  period: string;
  contractsCount: number;
  salesValueEgp: number;
  ratePct: string;
  commissionEgp: number;
  status: CommissionStatus;
}

export interface UpsertCommissionInput {
  agentId: string;
  period: string;
  contractsCount: number;
  salesValueEgp: number;
  ratePct: number;
}

@Injectable()
export class CommissionsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(agentId?: string): Promise<CommissionRow[]> {
    let q = realestateDb().selectFrom("realestate_commissions").selectAll().where("organization_id", "=", this.org());
    if (agentId) q = q.where("agent_id", "=", agentId);
    const rows = await q.orderBy("period", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<CommissionRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_commissions")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async upsert(input: UpsertCommissionInput): Promise<CommissionRow> {
    const commissionEgp = Math.round(input.salesValueEgp * (input.ratePct / 100));
    const period = new Date(input.period);
    const existing = await realestateDb()
      .selectFrom("realestate_commissions")
      .select(["id"])
      .where("organization_id", "=", this.org())
      .where("agent_id", "=", input.agentId)
      .where("period", "=", period)
      .executeTakeFirst();

    if (existing) {
      await realestateDb()
        .updateTable("realestate_commissions")
        .set({
          contracts_count: input.contractsCount,
          sales_value_egp: input.salesValueEgp,
          rate_pct: String(input.ratePct),
          commission_egp: commissionEgp,
        })
        .where("organization_id", "=", this.org())
        .where("id", "=", existing.id)
        .execute();
      return (await this.findById(existing.id))!;
    }

    const id = realestateId("com");
    await realestateDb()
      .insertInto("realestate_commissions")
      .values({
        id,
        organization_id: this.org(),
        agent_id: input.agentId,
        period,
        contracts_count: input.contractsCount,
        sales_value_egp: input.salesValueEgp,
        rate_pct: String(input.ratePct),
        commission_egp: commissionEgp,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async updateStatus(id: string, status: CommissionStatus): Promise<CommissionRow | null> {
    await realestateDb()
      .updateTable("realestate_commissions")
      .set({ status })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    agent_id: string;
    period: string | Date;
    contracts_count: number;
    sales_value_egp: number;
    rate_pct: string;
    commission_egp: number;
    status: CommissionStatus;
  }): CommissionRow {
    return {
      id: r.id,
      agentId: r.agent_id,
      period: new Date(r.period).toISOString().slice(0, 10),
      contractsCount: r.contracts_count,
      salesValueEgp: r.sales_value_egp,
      ratePct: r.rate_pct,
      commissionEgp: r.commission_egp,
      status: r.status,
    };
  }
}
