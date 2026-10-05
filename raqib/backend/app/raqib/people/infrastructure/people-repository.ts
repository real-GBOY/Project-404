import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { RoleKey } from "@raqib/raqib/shared/modules.js";
import type { PersonStatus } from "../domain/person.js";
import { fetchSize, type Page } from "@raqib/raqib/shared/paging.js";

export interface ProfileRecord {
  userId: string;
  roleKey: RoleKey;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  employeeNo: string | null;
  phone: string | null;
  status: PersonStatus;
  lastActiveAt: Date | null;
}

export interface ProfileInput {
  userId: string;
  roleKey: RoleKey;
  nameAr: string;
  nameEn: string;
  titleAr?: string;
  titleEn?: string;
  employeeNo?: string | null;
  phone?: string | null;
  status?: PersonStatus;
}

const COLS = ["user_id", "role_key", "name_ar", "name_en", "title_ar", "title_en", "employee_no", "phone", "status", "last_active_at"] as const;

function toRecord(r: {
  user_id: string;
  role_key: RoleKey;
  name_ar: string;
  name_en: string;
  title_ar: string;
  title_en: string;
  employee_no: string | null;
  phone: string | null;
  status: PersonStatus;
  last_active_at: Date | null;
}): ProfileRecord {
  return {
    userId: r.user_id,
    roleKey: r.role_key,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    titleAr: r.title_ar,
    titleEn: r.title_en,
    employeeNo: r.employee_no,
    phone: r.phone,
    status: r.status,
    lastActiveAt: r.last_active_at,
  };
}

@Injectable()
export class PeopleRepository {
  async list(page?: Page): Promise<ProfileRecord[]> {
    let q = raqibDb()
      .selectFrom("raqib_profiles")
      .select([...COLS])
      .orderBy("name_en")
      .orderBy("user_id");
    if (page) q = q.limit(fetchSize(page)).offset(page.offset);
    const rows = await q.execute();
    return rows.map(toRecord);
  }

  async find(userId: string): Promise<ProfileRecord | null> {
    const r = await raqibDb()
      .selectFrom("raqib_profiles")
      .select([...COLS])
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return r ? toRecord(r) : null;
  }

  async findMany(userIds: string[]): Promise<ProfileRecord[]> {
    if (!userIds.length) return [];
    const rows = await raqibDb()
      .selectFrom("raqib_profiles")
      .select([...COLS])
      .where("user_id", "in", userIds)
      .execute();
    return rows.map(toRecord);
  }

  async insert(input: ProfileInput): Promise<void> {
    const orgId = getContext()?.organizationId;
    if (!orgId) throw new Error("profile insert outside a tenant context");
    await raqibDb()
      .insertInto("raqib_profiles")
      .values({
        organization_id: orgId,
        user_id: input.userId,
        role_key: input.roleKey,
        name_ar: input.nameAr,
        name_en: input.nameEn,
        title_ar: input.titleAr ?? "",
        title_en: input.titleEn ?? "",
        employee_no: input.employeeNo ?? null,
        phone: input.phone ?? null,
        status: input.status ?? "active",
      })
      .execute();
  }

  async setRole(userId: string, role: RoleKey, titleAr: string, titleEn: string): Promise<void> {
    await raqibDb().updateTable("raqib_profiles").set({ role_key: role, title_ar: titleAr, title_en: titleEn }).where("user_id", "=", userId).execute();
  }

  async setStatus(userId: string, status: PersonStatus): Promise<void> {
    await raqibDb().updateTable("raqib_profiles").set({ status }).where("user_id", "=", userId).execute();
  }

  async touch(userId: string, at: Date): Promise<void> {
    await raqibDb().updateTable("raqib_profiles").set({ last_active_at: at }).where("user_id", "=", userId).execute();
  }

  /** Ids of the organization's live projects (to validate a scope edit without a module cycle). */
  async projectIds(): Promise<string[]> {
    const rows = await raqibDb().selectFrom("raqib_projects").select("id").where("archived_at", "is", null).execute();
    return rows.map((r) => r.id);
  }

  // ── project assignments (dated) ─────────────────────────────────────────

  async activeAssignments(today: string): Promise<Array<{ userId: string; projectId: string }>> {
    const rows = await raqibDb()
      .selectFrom("raqib_project_assignments")
      .select(["user_id", "project_id"])
      .where(sql<boolean>`valid_from <= ${today}::date`)
      .where(sql<boolean>`(valid_to IS NULL OR valid_to > ${today}::date)`)
      .execute();
    return rows.map((r) => ({ userId: r.user_id, projectId: r.project_id }));
  }

  async activeProjectIds(userId: string, today: string): Promise<string[]> {
    return (await this.activeAssignments(today)).filter((a) => a.userId === userId).map((a) => a.projectId);
  }

  async openAssignmentProjectIds(userId: string): Promise<string[]> {
    const rows = await raqibDb()
      .selectFrom("raqib_project_assignments")
      .select("project_id")
      .where("user_id", "=", userId)
      .where("valid_to", "is", null)
      .execute();
    return rows.map((r) => r.project_id);
  }

  async assign(userId: string, projectId: string, today: string, actorId: string, reason: string | null): Promise<void> {
    const orgId = getContext()?.organizationId;
    if (!orgId) throw new Error("assignment outside a tenant context");
    await raqibDb()
      .insertInto("raqib_project_assignments")
      .values({
        id: raqibId("asg"),
        organization_id: orgId,
        user_id: userId,
        project_id: projectId,
        valid_from: sql`${today}::date` as never,
        created_by: actorId,
        reason,
      })
      .execute();
  }

  /** End the open assignment: history stays, scope ends today. */
  async endAssignment(userId: string, projectId: string, today: string, actorId: string): Promise<void> {
    await raqibDb()
      .updateTable("raqib_project_assignments")
      .set({ valid_to: sql`GREATEST(${today}::date, valid_from)` as never, ended_by: actorId })
      .where("user_id", "=", userId)
      .where("project_id", "=", projectId)
      .where("valid_to", "is", null)
      .execute();
  }
}
