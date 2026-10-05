import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import type { ProjectStatus } from "../domain/project.js";

export interface ProjectRecord {
  id: string;
  code: string;
  name: L10n;
  city: L10n;
  region: L10n;
  managerUserId: string | null;
  status: ProjectStatus;
  firstVisitDate: string | null;
}
export interface SiteRecord {
  id: string;
  projectId: string;
  name: L10n;
  sortOrder: number;
}
export interface AreaRecord {
  id: string;
  siteId: string;
  name: L10n;
  sortOrder: number;
}
export interface GuardRecord {
  id: string;
  projectId: string;
  userId: string | null;
  employeeNo: string;
  nationalId: string;
  name: L10n;
  post: L10n;
  shift: "morning" | "evening" | "night";
  status: "active" | "inactive";
}

export interface ProjectInput {
  code: string;
  name: L10n;
  city: L10n;
  region: L10n;
  managerUserId?: string | null;
  status?: ProjectStatus;
  firstVisitDate?: string | null;
}
export interface GuardInput {
  projectId: string;
  employeeNo: string;
  nationalId: string;
  name: L10n;
  post: L10n;
  shift: "morning" | "evening" | "night";
  userId?: string | null;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("projects repository used outside a tenant context");
  return id;
};

type ProjectRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  city_ar: string;
  city_en: string;
  region_ar: string;
  region_en: string;
  manager_user_id: string | null;
  status: ProjectStatus;
  first_visit_date: string | null;
};

const toProject = (r: ProjectRow): ProjectRecord => ({
  id: r.id,
  code: r.code,
  name: { ar: r.name_ar, en: r.name_en },
  city: { ar: r.city_ar, en: r.city_en },
  region: { ar: r.region_ar, en: r.region_en },
  managerUserId: r.manager_user_id,
  status: r.status,
  firstVisitDate: r.first_visit_date,
});

type GuardRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  employee_no: string;
  national_id: string;
  name_ar: string;
  name_en: string;
  post_ar: string;
  post_en: string;
  shift: "morning" | "evening" | "night";
  status: "active" | "inactive";
};

const toGuard = (r: GuardRow): GuardRecord => ({
  id: r.id,
  projectId: r.project_id,
  userId: r.user_id,
  employeeNo: r.employee_no,
  nationalId: r.national_id,
  name: { ar: r.name_ar, en: r.name_en },
  post: { ar: r.post_ar, en: r.post_en },
  shift: r.shift,
  status: r.status,
});

@Injectable()
export class ProjectsRepository {
  private projectQuery() {
    return raqibDb()
      .selectFrom("raqib_projects")
      .select([
        "id",
        "code",
        "name_ar",
        "name_en",
        "city_ar",
        "city_en",
        "region_ar",
        "region_en",
        "manager_user_id",
        "status",
        sql<string | null>`first_visit_date::text`.as("first_visit_date"),
      ])
      .where("archived_at", "is", null);
  }

  async list(): Promise<ProjectRecord[]> {
    return (await this.projectQuery().orderBy("code").execute()).map(toProject);
  }

  async find(id: string): Promise<ProjectRecord | null> {
    const r = await this.projectQuery().where("id", "=", id).executeTakeFirst();
    return r ? toProject(r) : null;
  }

  async create(input: ProjectInput): Promise<string> {
    const id = raqibId("prj");
    await raqibDb()
      .insertInto("raqib_projects")
      .values({
        id,
        organization_id: org(),
        code: input.code,
        name_ar: input.name.ar,
        name_en: input.name.en,
        city_ar: input.city.ar,
        city_en: input.city.en,
        region_ar: input.region.ar,
        region_en: input.region.en,
        manager_user_id: input.managerUserId ?? null,
        status: input.status ?? "active",
        first_visit_date: input.firstVisitDate ? (sql`${input.firstVisitDate}::date` as never) : null,
      })
      .execute();
    return id;
  }

  async update(id: string, patch: Partial<ProjectInput>): Promise<void> {
    const set: Record<string, unknown> = {};
    if (patch.name) {
      set.name_ar = patch.name.ar;
      set.name_en = patch.name.en;
    }
    if (patch.city) {
      set.city_ar = patch.city.ar;
      set.city_en = patch.city.en;
    }
    if (patch.region) {
      set.region_ar = patch.region.ar;
      set.region_en = patch.region.en;
    }
    if (patch.managerUserId !== undefined) set.manager_user_id = patch.managerUserId;
    if (patch.status) set.status = patch.status;
    if (patch.firstVisitDate !== undefined) {
      set.first_visit_date = patch.firstVisitDate ? sql`${patch.firstVisitDate}::date` : null;
    }
    if (!Object.keys(set).length) return;
    await raqibDb().updateTable("raqib_projects").set(set as never).where("id", "=", id).execute();
  }

  // ── sites & areas ───────────────────────────────────────────────────────

  async sites(projectIds?: string[]): Promise<SiteRecord[]> {
    let q = raqibDb()
      .selectFrom("raqib_sites")
      .select(["id", "project_id", "name_ar", "name_en", "sort_order"])
      .where("archived_at", "is", null);
    if (projectIds) q = q.where("project_id", "in", projectIds.length ? projectIds : ["-"]);
    const rows = await q.orderBy("sort_order").orderBy("name_en").execute();
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: { ar: r.name_ar, en: r.name_en },
      sortOrder: r.sort_order,
    }));
  }

  async findSite(id: string): Promise<SiteRecord | null> {
    const r = await raqibDb()
      .selectFrom("raqib_sites")
      .select(["id", "project_id", "name_ar", "name_en", "sort_order"])
      .where("id", "=", id)
      .where("archived_at", "is", null)
      .executeTakeFirst();
    return r
      ? { id: r.id, projectId: r.project_id, name: { ar: r.name_ar, en: r.name_en }, sortOrder: r.sort_order }
      : null;
  }

  async createSite(projectId: string, name: L10n, sortOrder = 0): Promise<string> {
    const id = raqibId("ste");
    await raqibDb()
      .insertInto("raqib_sites")
      .values({ id, organization_id: org(), project_id: projectId, name_ar: name.ar, name_en: name.en, sort_order: sortOrder })
      .execute();
    return id;
  }

  async updateSite(id: string, name: L10n): Promise<void> {
    await raqibDb().updateTable("raqib_sites").set({ name_ar: name.ar, name_en: name.en }).where("id", "=", id).execute();
  }

  async archiveSite(id: string): Promise<void> {
    await raqibDb().updateTable("raqib_sites").set({ archived_at: sql`now()` as never }).where("id", "=", id).execute();
  }

  async areas(siteIds: string[]): Promise<AreaRecord[]> {
    if (!siteIds.length) return [];
    const rows = await raqibDb()
      .selectFrom("raqib_areas")
      .select(["id", "site_id", "name_ar", "name_en", "sort_order"])
      .where("site_id", "in", siteIds)
      .where("archived_at", "is", null)
      .orderBy("sort_order")
      .orderBy("name_en")
      .execute();
    return rows.map((r) => ({ id: r.id, siteId: r.site_id, name: { ar: r.name_ar, en: r.name_en }, sortOrder: r.sort_order }));
  }

  /** Every live area in the organization (RLS scopes the tenant) — for read models that join areas by id. */
  async areasBySite(): Promise<AreaRecord[]> {
    const rows = await raqibDb()
      .selectFrom("raqib_areas")
      .select(["id", "site_id", "name_ar", "name_en", "sort_order"])
      .where("archived_at", "is", null)
      .execute();
    return rows.map((r) => ({ id: r.id, siteId: r.site_id, name: { ar: r.name_ar, en: r.name_en }, sortOrder: r.sort_order }));
  }

  async findArea(id: string): Promise<AreaRecord | null> {
    const r = await raqibDb()
      .selectFrom("raqib_areas")
      .select(["id", "site_id", "name_ar", "name_en", "sort_order"])
      .where("id", "=", id)
      .where("archived_at", "is", null)
      .executeTakeFirst();
    return r ? { id: r.id, siteId: r.site_id, name: { ar: r.name_ar, en: r.name_en }, sortOrder: r.sort_order } : null;
  }

  async createArea(siteId: string, name: L10n, sortOrder = 0): Promise<string> {
    const id = raqibId("are");
    await raqibDb()
      .insertInto("raqib_areas")
      .values({ id, organization_id: org(), site_id: siteId, name_ar: name.ar, name_en: name.en, sort_order: sortOrder })
      .execute();
    return id;
  }

  async archiveArea(id: string): Promise<void> {
    await raqibDb().updateTable("raqib_areas").set({ archived_at: sql`now()` as never }).where("id", "=", id).execute();
  }

  // ── guards ──────────────────────────────────────────────────────────────

  async guards(projectIds?: string[]): Promise<GuardRecord[]> {
    let q = raqibDb().selectFrom("raqib_guards").selectAll();
    if (projectIds) q = q.where("project_id", "in", projectIds.length ? projectIds : ["-"]);
    return (await q.orderBy("employee_no").execute()).map(toGuard);
  }

  async findGuard(id: string): Promise<GuardRecord | null> {
    const r = await raqibDb().selectFrom("raqib_guards").selectAll().where("id", "=", id).executeTakeFirst();
    return r ? toGuard(r) : null;
  }

  async guardCounts(): Promise<Map<string, number>> {
    const rows = await raqibDb()
      .selectFrom("raqib_guards")
      .select(["project_id", sql<number>`count(*)::int`.as("n")])
      .where("status", "=", "active")
      .groupBy("project_id")
      .execute();
    return new Map(rows.map((r) => [r.project_id, r.n]));
  }

  async createGuard(input: GuardInput): Promise<string> {
    const id = raqibId("grd");
    await raqibDb()
      .insertInto("raqib_guards")
      .values({
        id,
        organization_id: org(),
        project_id: input.projectId,
        user_id: input.userId ?? null,
        employee_no: input.employeeNo,
        national_id: input.nationalId,
        name_ar: input.name.ar,
        name_en: input.name.en,
        post_ar: input.post.ar,
        post_en: input.post.en,
        shift: input.shift,
      })
      .execute();
    return id;
  }
}
