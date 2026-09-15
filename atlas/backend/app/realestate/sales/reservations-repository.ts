import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import { combinedRelevance } from "@atlas/realestate/shared/search.js";

export type ReservationStatus = "active" | "expiring" | "expired" | "converted";

export interface ReservationFilter {
  status?: ReservationStatus;
  agentId?: string;
  /** Joins to the unit to scope by project. */
  projectId?: string;
  /** Free-text search across customer name / unit code, ranked by relevance. */
  q?: string;
}

export interface ReservationRow {
  id: string;
  unitId: string;
  customerId: string;
  agentId: string;
  reservedAt: Date;
  expiresAt: Date;
  depositEgp: number;
  status: ReservationStatus;
}

export interface CreateReservationInput {
  unitId: string;
  customerId: string;
  agentId: string;
  expiresAt: string;
  depositEgp: number;
}

@Injectable()
export class ReservationsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: ReservationFilter = {}): Promise<ReservationRow[]> {
    let q = realestateDb()
      .selectFrom("realestate_reservations")
      .selectAll("realestate_reservations")
      .where("realestate_reservations.organization_id", "=", this.org());
    if (filter.status) q = q.where("realestate_reservations.status", "=", filter.status);
    if (filter.agentId) q = q.where("realestate_reservations.agent_id", "=", filter.agentId);

    const term = filter.q?.trim();

    if (term) {
      let joined = q
        .innerJoin("realestate_units", (join) =>
          join
            .onRef("realestate_units.id", "=", "realestate_reservations.unit_id")
            .onRef("realestate_units.organization_id", "=", "realestate_reservations.organization_id"),
        )
        .innerJoin("realestate_customers", (join) =>
          join
            .onRef("realestate_customers.id", "=", "realestate_reservations.customer_id")
            .onRef("realestate_customers.organization_id", "=", "realestate_reservations.organization_id"),
        );
      if (filter.projectId) joined = joined.where("realestate_units.project_id", "=", filter.projectId);
      const score = combinedRelevance([{ column: "realestate_customers.name" }, { column: "realestate_units.code", weight: 0.8 }], term);
      const rows = await joined
        .select(score.as("relevance_score"))
        .where(score, ">", 0)
        .orderBy("relevance_score", "desc")
        .orderBy("realestate_reservations.reserved_at", "desc")
        .execute();
      return rows.map((r) => this.toRow(r));
    }

    if (filter.projectId) {
      const rows = await q
        .innerJoin("realestate_units", (join) =>
          join
            .onRef("realestate_units.id", "=", "realestate_reservations.unit_id")
            .onRef("realestate_units.organization_id", "=", "realestate_reservations.organization_id"),
        )
        .where("realestate_units.project_id", "=", filter.projectId)
        .orderBy("realestate_reservations.reserved_at", "desc")
        .execute();
      return rows.map((r) => this.toRow(r));
    }

    const rows = await q.orderBy("realestate_reservations.reserved_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<ReservationRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_reservations")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async findByUnit(unitId: string): Promise<ReservationRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_reservations")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("unit_id", "=", unitId)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateReservationInput): Promise<ReservationRow> {
    const id = realestateId("rsv");
    await realestateDb()
      .insertInto("realestate_reservations")
      .values({
        id,
        organization_id: this.org(),
        unit_id: input.unitId,
        customer_id: input.customerId,
        agent_id: input.agentId,
        expires_at: input.expiresAt,
        deposit_egp: input.depositEgp,
        status: "active",
      })
      .execute();
    return (await this.findById(id))!;
  }

  async updateStatus(id: string, status: ReservationStatus): Promise<ReservationRow | null> {
    await realestateDb()
      .updateTable("realestate_reservations")
      .set({ status })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    unit_id: string;
    customer_id: string;
    agent_id: string;
    reserved_at: Date | string;
    expires_at: Date | string;
    deposit_egp: number;
    status: ReservationStatus;
  }): ReservationRow {
    return {
      id: r.id,
      unitId: r.unit_id,
      customerId: r.customer_id,
      agentId: r.agent_id,
      reservedAt: new Date(r.reserved_at),
      expiresAt: new Date(r.expires_at),
      depositEgp: r.deposit_egp,
      status: r.status,
    };
  }
}
