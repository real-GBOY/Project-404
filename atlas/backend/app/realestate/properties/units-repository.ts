import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import type { UnitStatus } from "./unit.domain.js";

export interface UnitRow {
  id: string;
  buildingId: string;
  projectId: string;
  code: string;
  floor: number;
  unitType: string;
  areaSqm: string;
  basePriceEgp: number;
  status: UnitStatus;
  currentCustomerId: string | null;
  currentAgentId: string | null;
  createdAt: Date;
}

export interface UnitFilter {
  projectId?: string;
  buildingId?: string;
  status?: UnitStatus;
}

export interface CreateUnitInput {
  buildingId: string;
  projectId: string;
  code: string;
  floor: number;
  unitType: string;
  areaSqm: number;
  basePriceEgp: number;
  status?: UnitStatus;
}

@Injectable()
export class UnitsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: UnitFilter): Promise<UnitRow[]> {
    let q = realestateDb()
      .selectFrom("realestate_units")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (filter.projectId) q = q.where("project_id", "=", filter.projectId);
    if (filter.buildingId) q = q.where("building_id", "=", filter.buildingId);
    if (filter.status) q = q.where("status", "=", filter.status);
    const rows = await q.orderBy("code", "asc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<UnitRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_units")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async availabilitySummary(): Promise<
    Array<{ projectId: string; unitType: string; available: number; reserved: number; sold: number; priceFromEgp: number }>
  > {
    const rows = await realestateDb()
      .selectFrom("realestate_units")
      .select(["project_id", "unit_type", "status", "base_price_egp"])
      .where("organization_id", "=", this.org())
      .execute();
    const groups = new Map<string, { projectId: string; unitType: string; available: number; reserved: number; sold: number; priceFromEgp: number }>();
    for (const r of rows) {
      const key = `${r.project_id}::${r.unit_type}`;
      const g = groups.get(key) ?? { projectId: r.project_id, unitType: r.unit_type, available: 0, reserved: 0, sold: 0, priceFromEgp: r.base_price_egp };
      if (r.status === "available") g.available++;
      if (r.status === "reserved") g.reserved++;
      if (r.status === "sold") g.sold++;
      g.priceFromEgp = Math.min(g.priceFromEgp, r.base_price_egp);
      groups.set(key, g);
    }
    return [...groups.values()];
  }

  async bulkInsert(rows: (CreateUnitInput & { id?: string })[]): Promise<void> {
    if (rows.length === 0) return;
    const org = this.org();
    await realestateDb()
      .insertInto("realestate_units")
      .values(
        rows.map((r) => ({
          id: r.id ?? realestateId("unt"),
          organization_id: org,
          building_id: r.buildingId,
          project_id: r.projectId,
          code: r.code,
          floor: r.floor,
          unit_type: r.unitType,
          area_sqm: String(r.areaSqm),
          base_price_egp: r.basePriceEgp,
          status: r.status ?? "available",
        })),
      )
      .execute();
  }

  async updateStatus(
    id: string,
    status: UnitStatus,
    links?: { customerId?: string | null; agentId?: string | null },
  ): Promise<UnitRow | null> {
    const set: Record<string, unknown> = { status };
    if (links?.customerId !== undefined) set.current_customer_id = links.customerId;
    if (links?.agentId !== undefined) set.current_agent_id = links.agentId;
    await realestateDb()
      .updateTable("realestate_units")
      .set(set)
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    building_id: string;
    project_id: string;
    code: string;
    floor: number;
    unit_type: string;
    area_sqm: string;
    base_price_egp: number;
    status: UnitStatus;
    current_customer_id: string | null;
    current_agent_id: string | null;
    created_at: Date | string;
  }): UnitRow {
    return {
      id: r.id,
      buildingId: r.building_id,
      projectId: r.project_id,
      code: r.code,
      floor: r.floor,
      unitType: r.unit_type,
      areaSqm: r.area_sqm,
      basePriceEgp: r.base_price_egp,
      status: r.status,
      currentCustomerId: r.current_customer_id,
      currentAgentId: r.current_agent_id,
      createdAt: new Date(r.created_at),
    };
  }
}
