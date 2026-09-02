import { Injectable } from "@nestjs/common";
import { currentExecutor } from "../../../../../core/kernel/db/db.js";
import { requireOrganizationId } from "../../../../../core/kernel/tenant.js";
import { lawfirmId } from "../shared/ids.js";

export interface StaffProfileRow {
  id: string;
  userId: string;
  title: string;
  phone: string | null;
  practiceAreas: string[];
  status: "active" | "inactive";
  weeklyCapacityHours: number;
  barAdmission: string | null;
}

@Injectable()
export class StaffRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async all(): Promise<StaffProfileRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_staff_profiles")
      .selectAll()
      .where("organization_id", "=", this.org())
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async byUserId(userId: string): Promise<StaffProfileRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_staff_profiles")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async findById(id: string): Promise<StaffProfileRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_staff_profiles")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async upsert(input: {
    userId: string;
    title?: string;
    phone?: string | null;
    practiceAreas?: string[];
    status?: "active" | "inactive";
    weeklyCapacityHours?: number;
    barAdmission?: string | null;
  }): Promise<StaffProfileRow> {
    const existing = await this.byUserId(input.userId);
    if (existing) {
      const set: Record<string, unknown> = {};
      if (input.title !== undefined) set.title = input.title;
      if (input.phone !== undefined) set.phone = input.phone;
      if (input.practiceAreas !== undefined) set.practice_areas = input.practiceAreas;
      if (input.status !== undefined) set.status = input.status;
      if (input.weeklyCapacityHours !== undefined) set.weekly_capacity_hours = input.weeklyCapacityHours;
      if (input.barAdmission !== undefined) set.bar_admission = input.barAdmission;
      if (Object.keys(set).length > 0) {
        await currentExecutor()
          .updateTable("lawfirm_staff_profiles")
          .set(set)
          .where("organization_id", "=", this.org())
          .where("user_id", "=", input.userId)
          .execute();
      }
      return (await this.byUserId(input.userId))!;
    }
    const id = lawfirmId("stf");
    await currentExecutor()
      .insertInto("lawfirm_staff_profiles")
      .values({
        id,
        organization_id: this.org(),
        user_id: input.userId,
        title: input.title ?? "Associate",
        phone: input.phone ?? null,
        practice_areas: input.practiceAreas ?? [],
        status: input.status ?? "active",
        weekly_capacity_hours: input.weeklyCapacityHours ?? 40,
        bar_admission: input.barAdmission ?? null,
      })
      .execute();
    return (await this.byUserId(input.userId))!;
  }

  private toRow(r: {
    id: string;
    user_id: string;
    title: string;
    phone: string | null;
    practice_areas: string[];
    status: "active" | "inactive";
    weekly_capacity_hours: number;
    bar_admission: string | null;
  }): StaffProfileRow {
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      phone: r.phone,
      practiceAreas: r.practice_areas ?? [],
      status: r.status,
      weeklyCapacityHours: r.weekly_capacity_hours,
      barAdmission: r.bar_admission,
    };
  }
}
