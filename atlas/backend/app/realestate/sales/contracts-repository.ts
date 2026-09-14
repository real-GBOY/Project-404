import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type ContractStatus = "draft" | "awaiting-approval" | "signed";

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

  async list(status?: ContractStatus): Promise<ContractRow[]> {
    let q = realestateDb().selectFrom("realestate_contracts").selectAll().where("organization_id", "=", this.org());
    if (status) q = q.where("status", "=", status);
    const rows = await q.orderBy("created_at", "desc").execute();
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
