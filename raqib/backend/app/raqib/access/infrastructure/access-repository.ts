import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import type { RoleKey } from "@raqib/raqib/shared/modules.js";

export interface ProfileRow {
  userId: string;
  roleKey: RoleKey;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  status: "active" | "invited" | "disabled";
}

@Injectable()
export class AccessRepository {
  async profile(userId: string): Promise<ProfileRow | null> {
    const r = await raqibDb()
      .selectFrom("raqib_profiles")
      .select(["user_id", "role_key", "name_ar", "name_en", "title_ar", "title_en", "status"])
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return r
      ? {
          userId: r.user_id,
          roleKey: r.role_key,
          nameAr: r.name_ar,
          nameEn: r.name_en,
          titleAr: r.title_ar,
          titleEn: r.title_en,
          status: r.status,
        }
      : null;
  }

  async templateOverrides(role: RoleKey): Promise<Array<{ module: string; actions: string }>> {
    return raqibDb().selectFrom("raqib_role_templates").select(["module", "actions"]).where("role_key", "=", role).execute();
  }

  /** Projects the person is assigned to on `today` ([valid_from, valid_to)). */
  async activeProjectIds(userId: string, today: string): Promise<string[]> {
    const rows = await raqibDb()
      .selectFrom("raqib_project_assignments")
      .select("project_id")
      .where("user_id", "=", userId)
      .where(sql<boolean>`valid_from <= ${today}::date`)
      .where(sql<boolean>`(valid_to IS NULL OR valid_to > ${today}::date)`)
      .execute();
    return rows.map((r) => r.project_id);
  }

  async allProfiles(): Promise<ProfileRow[]> {
    const rows = await raqibDb().selectFrom("raqib_profiles").select(["user_id", "role_key", "name_ar", "name_en", "title_ar", "title_en", "status"]).execute();
    return rows.map((r) => ({
      userId: r.user_id,
      roleKey: r.role_key,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      titleAr: r.title_ar,
      titleEn: r.title_en,
      status: r.status,
    }));
  }

  async allOverrides(): Promise<Array<{ role_key: RoleKey; module: string; actions: string }>> {
    return raqibDb().selectFrom("raqib_role_templates").select(["role_key", "module", "actions"]).execute();
  }

  async activeAssignments(today: string): Promise<Array<{ userId: string; projectId: string }>> {
    const rows = await raqibDb()
      .selectFrom("raqib_project_assignments")
      .select(["user_id", "project_id"])
      .where(sql<boolean>`valid_from <= ${today}::date`)
      .where(sql<boolean>`(valid_to IS NULL OR valid_to > ${today}::date)`)
      .execute();
    return rows.map((r) => ({ userId: r.user_id, projectId: r.project_id }));
  }
}
