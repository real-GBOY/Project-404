import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type CustomerStatus = "active" | "pending";

export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  primaryProjectId: string | null;
  agentId: string;
  status: CustomerStatus;
  sinceDate: string;
  nationalId: string | null;
  address: string | null;
  createdAt: Date;
}

export interface CreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  primaryProjectId?: string | null;
  agentId: string;
  nationalId?: string | null;
  address?: string | null;
}

@Injectable()
export class CustomersRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(): Promise<CustomerRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_customers")
      .selectAll()
      .where("organization_id", "=", this.org())
      .orderBy("name", "asc")
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<CustomerRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_customers")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateCustomerInput): Promise<CustomerRow> {
    const id = realestateId("cus");
    await realestateDb()
      .insertInto("realestate_customers")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        primary_project_id: input.primaryProjectId ?? null,
        agent_id: input.agentId,
        national_id: input.nationalId ?? null,
        address: input.address ?? null,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<CreateCustomerInput> & { status?: CustomerStatus }): Promise<CustomerRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.email !== undefined) set.email = patch.email;
    if (patch.phone !== undefined) set.phone = patch.phone;
    if (patch.agentId !== undefined) set.agent_id = patch.agentId;
    if (patch.status !== undefined) set.status = patch.status;
    if (Object.keys(set).length > 0) {
      await realestateDb()
        .updateTable("realestate_customers")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  /** Batched per-customer rollup for the list screen (units owned, portfolio value, amount collected) —
   *  mirrors `FinanceQueries`'s reduce-in-JS join pattern rather than a SQL GROUP BY. */
  async statsByCustomer(): Promise<Map<string, { unitsOwned: number; portfolioEgp: number; collectedEgp: number }>> {
    const org = this.org();
    const [units, plans, installments] = await Promise.all([
      realestateDb().selectFrom("realestate_customer_units").select(["customer_id"]).where("organization_id", "=", org).execute(),
      realestateDb().selectFrom("realestate_payment_plans").select(["customer_id", "total_egp"]).where("organization_id", "=", org).execute(),
      realestateDb()
        .selectFrom("realestate_installments")
        .innerJoin("realestate_payment_plans", (join) =>
          join
            .onRef("realestate_payment_plans.id", "=", "realestate_installments.payment_plan_id")
            .onRef("realestate_payment_plans.organization_id", "=", "realestate_installments.organization_id"),
        )
        .select(["realestate_payment_plans.customer_id as customerId", "realestate_installments.paid_egp as paidEgp"])
        .where("realestate_installments.organization_id", "=", org)
        .execute(),
    ]);

    const stats = new Map<string, { unitsOwned: number; portfolioEgp: number; collectedEgp: number }>();
    const bump = (id: string, patch: Partial<{ unitsOwned: number; portfolioEgp: number; collectedEgp: number }>) => {
      const cur = stats.get(id) ?? { unitsOwned: 0, portfolioEgp: 0, collectedEgp: 0 };
      stats.set(id, {
        unitsOwned: cur.unitsOwned + (patch.unitsOwned ?? 0),
        portfolioEgp: cur.portfolioEgp + (patch.portfolioEgp ?? 0),
        collectedEgp: cur.collectedEgp + (patch.collectedEgp ?? 0),
      });
    };
    for (const u of units) bump(u.customer_id, { unitsOwned: 1 });
    for (const p of plans) bump(p.customer_id, { portfolioEgp: p.total_egp });
    for (const i of installments) bump(i.customerId, { collectedEgp: i.paidEgp });
    return stats;
  }

  async unitsOwned(customerId: string): Promise<string[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_customer_units")
      .select(["unit_id"])
      .where("organization_id", "=", this.org())
      .where("customer_id", "=", customerId)
      .execute();
    return rows.map((r) => r.unit_id);
  }

  async linkUnit(customerId: string, unitId: string): Promise<void> {
    await realestateDb()
      .insertInto("realestate_customer_units")
      .values({ id: realestateId("cun"), organization_id: this.org(), customer_id: customerId, unit_id: unitId })
      .execute();
  }

  private toRow(r: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    primary_project_id: string | null;
    agent_id: string;
    status: CustomerStatus;
    since_date: string | Date;
    national_id: string | null;
    address: string | null;
    created_at: Date | string;
  }): CustomerRow {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      primaryProjectId: r.primary_project_id,
      agentId: r.agent_id,
      status: r.status,
      sinceDate: new Date(r.since_date).toISOString().slice(0, 10),
      nationalId: r.national_id,
      address: r.address,
      createdAt: new Date(r.created_at),
    };
  }
}
