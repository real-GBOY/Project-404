import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type PriceListStatus = "draft" | "awaiting-approval" | "active";

export interface PriceListRow {
  id: string;
  projectId: string;
  name: string;
  version: string;
  basePerSqmEgp: number;
  floorPremiumPct: string;
  maxDiscountPct: string;
  effectiveDate: string;
  status: PriceListStatus;
  createdAt: Date;
}

export interface CreatePriceListInput {
  projectId: string;
  name: string;
  version: string;
  basePerSqmEgp: number;
  floorPremiumPct?: number;
  maxDiscountPct?: number;
  effectiveDate: string;
  status?: PriceListStatus;
}

@Injectable()
export class PriceListsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  /** Omit `projectId` for an org-wide list (the Pricing screen); pass it to scope to one project. */
  async listForProject(projectId?: string): Promise<PriceListRow[]> {
    let q = realestateDb().selectFrom("realestate_price_lists").selectAll().where("organization_id", "=", this.org());
    if (projectId) q = q.where("project_id", "=", projectId);
    const rows = await q
      .orderBy("effective_date", "desc")
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<PriceListRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_price_lists")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreatePriceListInput): Promise<PriceListRow> {
    const id = realestateId("prc");
    await realestateDb()
      .insertInto("realestate_price_lists")
      .values({
        id,
        organization_id: this.org(),
        project_id: input.projectId,
        name: input.name,
        version: input.version,
        base_per_sqm_egp: input.basePerSqmEgp,
        floor_premium_pct: String(input.floorPremiumPct ?? 0),
        max_discount_pct: String(input.maxDiscountPct ?? 0),
        effective_date: input.effectiveDate,
        status: input.status ?? "draft",
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<CreatePriceListInput>): Promise<PriceListRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.basePerSqmEgp !== undefined) set.base_per_sqm_egp = patch.basePerSqmEgp;
    if (patch.floorPremiumPct !== undefined) set.floor_premium_pct = String(patch.floorPremiumPct);
    if (patch.maxDiscountPct !== undefined) set.max_discount_pct = String(patch.maxDiscountPct);
    if (patch.status !== undefined) set.status = patch.status;
    if (Object.keys(set).length > 0) {
      await realestateDb()
        .updateTable("realestate_price_lists")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    project_id: string;
    name: string;
    version: string;
    base_per_sqm_egp: number;
    floor_premium_pct: string;
    max_discount_pct: string;
    effective_date: string | Date;
    status: PriceListStatus;
    created_at: Date | string;
  }): PriceListRow {
    return {
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      version: r.version,
      basePerSqmEgp: r.base_per_sqm_egp,
      floorPremiumPct: r.floor_premium_pct,
      maxDiscountPct: r.max_discount_pct,
      effectiveDate: new Date(r.effective_date).toISOString().slice(0, 10),
      status: r.status,
      createdAt: new Date(r.created_at),
    };
  }
}
