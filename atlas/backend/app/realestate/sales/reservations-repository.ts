import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type ReservationStatus = "active" | "expiring" | "expired" | "converted";

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

  async list(status?: ReservationStatus): Promise<ReservationRow[]> {
    let q = realestateDb().selectFrom("realestate_reservations").selectAll().where("organization_id", "=", this.org());
    if (status) q = q.where("status", "=", status);
    const rows = await q.orderBy("reserved_at", "desc").execute();
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
