import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type ProjectStatus = "pre-launch" | "launched" | "under-construction" | "delivered";

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  location: string;
  developer: string;
  status: ProjectStatus;
  totalUnits: number;
  soldUnits: number;
  reservedUnits: number;
  availableUnits: number;
  totalValueEgp: number;
  revenueEgp: number;
  velocityPerWeek: string;
  sellThroughPct: string;
  createdAt: Date;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  location: string;
  developer: string;
  status?: ProjectStatus;
}

@Injectable()
export class ProjectsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(): Promise<ProjectRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_projects")
      .selectAll()
      .where("organization_id", "=", this.org())
      .orderBy("name", "asc")
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<ProjectRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_projects")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async findBySlug(slug: string): Promise<ProjectRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_projects")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateProjectInput): Promise<ProjectRow> {
    const id = realestateId("prj");
    await realestateDb()
      .insertInto("realestate_projects")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        slug: input.slug,
        location: input.location,
        developer: input.developer,
        status: input.status ?? "launched",
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<CreateProjectInput>): Promise<ProjectRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.location !== undefined) set.location = patch.location;
    if (patch.developer !== undefined) set.developer = patch.developer;
    if (patch.status !== undefined) set.status = patch.status;
    if (Object.keys(set).length > 0) {
      await realestateDb()
        .updateTable("realestate_projects")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  /** Recomputes the denormalised unit/value rollups from `realestate_units`. */
  async refreshRollups(id: string): Promise<void> {
    const org = this.org();
    const units = await realestateDb()
      .selectFrom("realestate_units")
      .select(["status", "base_price_egp"])
      .where("organization_id", "=", org)
      .where("project_id", "=", id)
      .execute();
    const totalUnits = units.length;
    const soldUnits = units.filter((u) => u.status === "sold").length;
    const reservedUnits = units.filter((u) => u.status === "reserved").length;
    const availableUnits = units.filter((u) => u.status === "available").length;
    const totalValueEgp = units.reduce((sum, u) => sum + u.base_price_egp, 0);
    const revenueEgp = units
      .filter((u) => u.status === "sold" || u.status === "reserved")
      .reduce((sum, u) => sum + u.base_price_egp, 0);
    const sellThroughPct = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0;

    await realestateDb()
      .updateTable("realestate_projects")
      .set({ total_units: totalUnits, sold_units: soldUnits, reserved_units: reservedUnits, available_units: availableUnits, total_value_egp: totalValueEgp, revenue_egp: revenueEgp, sell_through_pct: sellThroughPct.toFixed(2) })
      .where("organization_id", "=", org)
      .where("id", "=", id)
      .execute();
  }

  private toRow(r: {
    id: string;
    name: string;
    slug: string;
    location: string;
    developer: string;
    status: ProjectStatus;
    total_units: number;
    sold_units: number;
    reserved_units: number;
    available_units: number;
    total_value_egp: number;
    revenue_egp: number;
    velocity_per_week: string;
    sell_through_pct: string;
    created_at: Date | string;
  }): ProjectRow {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      location: r.location,
      developer: r.developer,
      status: r.status,
      totalUnits: r.total_units,
      soldUnits: r.sold_units,
      reservedUnits: r.reserved_units,
      availableUnits: r.available_units,
      totalValueEgp: r.total_value_egp,
      revenueEgp: r.revenue_egp,
      velocityPerWeek: r.velocity_per_week,
      sellThroughPct: r.sell_through_pct,
      createdAt: new Date(r.created_at),
    };
  }
}
