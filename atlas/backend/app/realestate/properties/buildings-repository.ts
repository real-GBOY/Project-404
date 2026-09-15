import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type BuildingStatus = "pre-launch" | "launched" | "under-construction" | "delivered";

export interface BuildingRow {
  id: string;
  projectId: string;
  key: string;
  name: string;
  floors: number;
  unitsPerFloor: number;
  handoverDate: string | null;
  status: BuildingStatus;
  createdAt: Date;
}

export interface CreateBuildingInput {
  projectId: string;
  key: string;
  name: string;
  floors: number;
  unitsPerFloor: number;
  handoverDate?: string | null;
  status?: BuildingStatus;
}

@Injectable()
export class BuildingsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  /** Omit `projectId` for an org-wide list (the Buildings screen); pass it to scope to one project. */
  async listForProject(projectId?: string): Promise<BuildingRow[]> {
    let q = realestateDb().selectFrom("realestate_buildings").selectAll().where("organization_id", "=", this.org());
    if (projectId) q = q.where("project_id", "=", projectId);
    const rows = await q.orderBy("key", "asc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<BuildingRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_buildings")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateBuildingInput): Promise<BuildingRow> {
    const id = realestateId("bld");
    await realestateDb()
      .insertInto("realestate_buildings")
      .values({
        id,
        organization_id: this.org(),
        project_id: input.projectId,
        key: input.key,
        name: input.name,
        floors: input.floors,
        units_per_floor: input.unitsPerFloor,
        handover_date: input.handoverDate ?? null,
        status: input.status ?? "under-construction",
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<CreateBuildingInput>): Promise<BuildingRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.floors !== undefined) set.floors = patch.floors;
    if (patch.unitsPerFloor !== undefined) set.units_per_floor = patch.unitsPerFloor;
    if (patch.handoverDate !== undefined) set.handover_date = patch.handoverDate;
    if (patch.status !== undefined) set.status = patch.status;
    if (Object.keys(set).length > 0) {
      await realestateDb()
        .updateTable("realestate_buildings")
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
    key: string;
    name: string;
    floors: number;
    units_per_floor: number;
    handover_date: string | Date | null;
    status: BuildingStatus;
    created_at: Date | string;
  }): BuildingRow {
    return {
      id: r.id,
      projectId: r.project_id,
      key: r.key,
      name: r.name,
      floors: r.floors,
      unitsPerFloor: r.units_per_floor,
      handoverDate: r.handover_date ? new Date(r.handover_date).toISOString().slice(0, 10) : null,
      status: r.status,
      createdAt: new Date(r.created_at),
    };
  }
}
