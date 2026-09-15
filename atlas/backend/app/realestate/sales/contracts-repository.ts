import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import { combinedRelevance } from "@atlas/realestate/shared/search.js";

export type ContractStatus = "draft" | "awaiting-approval" | "signed";

export interface ContractFilter {
  status?: ContractStatus;
  /** Joins to the unit to scope by project. */
  projectId?: string;
  /** Free-text search across customer name / unit code, ranked by relevance. */
  q?: string;
}

export interface ContractRow {
  id: string;
  reservationId: string | null;
  customerId: string;
  unitId: string;
  valueEgp: number;
  signedDate: string | null;
  status: ContractStatus;
  createdAt: Date;
}

export interface CreateContractInput {
  reservationId?: string | null;
  customerId: string;
  unitId: string;
  valueEgp: number;
}

@Injectable()
export class ContractsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: ContractFilter = {}): Promise<ContractRow[]> {
    let q = realestateDb()
      .selectFrom("realestate_contracts")
      .selectAll("realestate_contracts")
      .where("realestate_contracts.organization_id", "=", this.org());
    if (filter.status) q = q.where("realestate_contracts.status", "=", filter.status);

    const term = filter.q?.trim();

    if (term) {
      let joined = q
        .innerJoin("realestate_units", (join) =>
          join
            .onRef("realestate_units.id", "=", "realestate_contracts.unit_id")
            .onRef("realestate_units.organization_id", "=", "realestate_contracts.organization_id"),
        )
        .innerJoin("realestate_customers", (join) =>
          join
            .onRef("realestate_customers.id", "=", "realestate_contracts.customer_id")
            .onRef("realestate_customers.organization_id", "=", "realestate_contracts.organization_id"),
        );
      if (filter.projectId) joined = joined.where("realestate_units.project_id", "=", filter.projectId);
      const score = combinedRelevance([{ column: "realestate_customers.name" }, { column: "realestate_units.code", weight: 0.8 }], term);
      const rows = await joined
        .select(score.as("relevance_score"))
        .where(score, ">", 0)
        .orderBy("relevance_score", "desc")
        .orderBy("realestate_contracts.created_at", "desc")
        .execute();
      return rows.map((r) => this.toRow(r));
    }

    if (filter.projectId) {
      const rows = await q
        .innerJoin("realestate_units", (join) =>
          join
            .onRef("realestate_units.id", "=", "realestate_contracts.unit_id")
            .onRef("realestate_units.organization_id", "=", "realestate_contracts.organization_id"),
        )
        .where("realestate_units.project_id", "=", filter.projectId)
        .orderBy("realestate_contracts.created_at", "desc")
        .execute();
      return rows.map((r) => this.toRow(r));
    }

    const rows = await q.orderBy("realestate_contracts.created_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<ContractRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_contracts")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateContractInput): Promise<ContractRow> {
    const id = realestateId("ctr");
    await realestateDb()
      .insertInto("realestate_contracts")
      .values({
        id,
        organization_id: this.org(),
        reservation_id: input.reservationId ?? null,
        customer_id: input.customerId,
        unit_id: input.unitId,
        value_egp: input.valueEgp,
        status: "draft",
      })
      .execute();
    return (await this.findById(id))!;
  }

  async sign(id: string, signedDate: string): Promise<ContractRow | null> {
    await realestateDb()
      .updateTable("realestate_contracts")
      .set({ status: "signed", signed_date: signedDate })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    reservation_id: string | null;
    customer_id: string;
    unit_id: string;
    value_egp: number;
    signed_date: string | Date | null;
    status: ContractStatus;
    created_at: Date | string;
  }): ContractRow {
    return {
      id: r.id,
      reservationId: r.reservation_id,
      customerId: r.customer_id,
      unitId: r.unit_id,
      valueEgp: r.value_egp,
      signedDate: r.signed_date ? new Date(r.signed_date).toISOString().slice(0, 10) : null,
      status: r.status,
      createdAt: new Date(r.created_at),
    };
  }
}
