import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { VisitStatus } from "../domain/visit-state.js";
import { fetchSize, type Page } from "@raqib/raqib/shared/paging.js";

export type VisitType = "routine" | "surprise" | "follow" | "night";
/** A configured shift key (settings.schedule.shifts); the first three are the ones visits started with. */
export type Shift = string;

export interface VisitRecord {
  id: string;
  ref: string;
  projectId: string;
  siteId: string;
  areaId: string | null;
  areaText: string | null;
  inspectorId: string | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  status: VisitStatus;
  round: number;
  overdueNotifiedAt: Date | null;
  createdAt: Date;
}

export interface NewVisit {
  ref: string;
  projectId: string;
  siteId: string;
  areaId?: string | null;
  areaText?: string | null;
  inspectorId: string | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  status: VisitStatus;
  createdBy: string | null;
}

export interface VisitEventRecord {
  id: string;
  visitId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  actorNameAr: string;
  actorNameEn: string;
  actorRole: string | null;
  actorTitleAr: string;
  actorTitleEn: string;
  reason: string | null;
  detail: Record<string, unknown> | null;
  at: Date;
}

export interface VisitFilter {
  projectIds?: string[];
  inspectorId?: string;
  from?: string;
  to?: string;
  statuses?: VisitStatus[];
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("visits repository used outside a tenant context");
  return id;
};

type Row = {
  id: string;
  ref: string;
  project_id: string;
  site_id: string;
  area_id: string | null;
  area_text: string | null;
  inspector_id: string | null;
  visit_type: VisitType;
  shift: Shift;
  scheduled_date: string;
  scheduled_time: string;
  status: VisitStatus;
  round: number;
  overdue_notified_at: Date | null;
  created_at: Date;
};

const toRecord = (r: Row): VisitRecord => ({
  id: r.id,
  ref: r.ref,
  projectId: r.project_id,
  siteId: r.site_id,
  areaId: r.area_id,
  areaText: r.area_text,
  inspectorId: r.inspector_id,
  type: r.visit_type,
  shift: r.shift,
  date: r.scheduled_date,
  time: r.scheduled_time,
  status: r.status,
  round: r.round,
  overdueNotifiedAt: r.overdue_notified_at,
  createdAt: r.created_at,
});

@Injectable()
export class VisitsRepository {
  private base() {
    return raqibDb()
      .selectFrom("raqib_visits")
      .select([
        "id",
        "ref",
        "project_id",
        "site_id",
        "area_id",
        "area_text",
        "inspector_id",
        "visit_type",
        "shift",
        sql<string>`scheduled_date::text`.as("scheduled_date"),
        "scheduled_time",
        "status",
        "round",
        "overdue_notified_at",
        "created_at",
      ]);
  }

  async list(f: VisitFilter = {}, page?: Page): Promise<VisitRecord[]> {
    let q = this.base();
    if (f.projectIds) q = q.where("project_id", "in", f.projectIds.length ? f.projectIds : ["-"]);
    if (f.inspectorId) q = q.where("inspector_id", "=", f.inspectorId);
    if (f.from) q = q.where(sql<boolean>`scheduled_date >= ${f.from}::date`);
    if (f.to) q = q.where(sql<boolean>`scheduled_date <= ${f.to}::date`);
    if (f.statuses?.length) q = q.where("status", "in", f.statuses);
    q = q.orderBy("scheduled_date").orderBy("scheduled_time").orderBy("id");
    if (page) q = q.limit(fetchSize(page)).offset(page.offset);
    return (await q.execute()).map(toRecord);
  }

  async find(id: string, lock = false): Promise<VisitRecord | null> {
    let q = this.base().where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toRecord(r) : null;
  }

  /** Live assignments of one inspector in a date window (the visits that count towards rest and consecutive-day rules). */
  async liveSlots(inspectorId: string, from: string, to: string, excludeId?: string): Promise<Array<{ date: string; time: string; shift: string }>> {
    let q = this.base()
      .where("inspector_id", "=", inspectorId)
      .where("status", "in", ["scheduled", "assigned", "in_progress", "returned"])
      .where(sql<boolean>`scheduled_date between ${from}::date and ${to}::date`);
    if (excludeId) q = q.where("id", "<>", excludeId);
    return (await q.execute()).map((r) => ({ date: r.scheduled_date, time: r.scheduled_time, shift: r.shift }));
  }

  async findByRef(ref: string): Promise<VisitRecord | null> {
    const r = await this.base().where("ref", "=", ref).executeTakeFirst();
    return r ? toRecord(r) : null;
  }

  async insert(v: NewVisit): Promise<string> {
    const id = raqibId("vis");
    await raqibDb()
      .insertInto("raqib_visits")
      .values({
        id,
        organization_id: org(),
        ref: v.ref,
        project_id: v.projectId,
        site_id: v.siteId,
        area_id: v.areaId ?? null,
        area_text: v.areaText ?? null,
        inspector_id: v.inspectorId,
        visit_type: v.type,
        shift: v.shift,
        scheduled_date: sql`${v.date}::date` as never,
        scheduled_time: v.time,
        status: v.status,
        created_by: v.createdBy,
      })
      .execute();
    return id;
  }

  async update(
    id: string,
    patch: Partial<{ date: string; time: string; inspectorId: string | null; status: VisitStatus; round: number; overdueNotifiedAt: Date | null }>,
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    if (patch.date) set.scheduled_date = sql`${patch.date}::date`;
    if (patch.time) set.scheduled_time = patch.time;
    if (patch.inspectorId !== undefined) set.inspector_id = patch.inspectorId;
    if (patch.status) set.status = patch.status;
    if (patch.round) set.round = patch.round;
    if (patch.overdueNotifiedAt !== undefined) set.overdue_notified_at = patch.overdueNotifiedAt;
    if (!Object.keys(set).length) return;
    await raqibDb()
      .updateTable("raqib_visits")
      .set(set as never)
      .where("id", "=", id)
      .execute();
  }

  // ── guards on shift ─────────────────────────────────────────────────────

  async guardIds(visitIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!visitIds.length) return out;
    const rows = await raqibDb().selectFrom("raqib_visit_guards").select(["visit_id", "guard_id"]).where("visit_id", "in", visitIds).execute();
    for (const r of rows) out.set(r.visit_id, [...(out.get(r.visit_id) ?? []), r.guard_id]);
    return out;
  }

  async setGuards(visitId: string, guardIds: string[]): Promise<void> {
    await raqibDb().deleteFrom("raqib_visit_guards").where("visit_id", "=", visitId).execute();
    if (!guardIds.length) return;
    await raqibDb()
      .insertInto("raqib_visit_guards")
      .values(guardIds.map((g) => ({ organization_id: org(), visit_id: visitId, guard_id: g })))
      .execute();
  }

  /** The forms each visit requires, in order. A visit with none uses the default site form. */
  async formIds(visitIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!visitIds.length) return out;
    const rows = await raqibDb()
      .selectFrom("raqib_visit_forms")
      .select(["visit_id", "form_id"])
      .where("visit_id", "in", visitIds)
      .orderBy("position")
      .execute();
    for (const r of rows) out.set(r.visit_id, [...(out.get(r.visit_id) ?? []), r.form_id]);
    return out;
  }

  async setForms(visitId: string, formIds: string[]): Promise<void> {
    await raqibDb().deleteFrom("raqib_visit_forms").where("visit_id", "=", visitId).execute();
    if (!formIds.length) return;
    await raqibDb()
      .insertInto("raqib_visit_forms")
      .values(formIds.map((f, position) => ({ organization_id: org(), visit_id: visitId, form_id: f, position })))
      .execute();
  }

  /**
   * Stored inspection scores by visit (set at submission) - a read model for lists; the inspection module owns the data.
   * A visit with several forms shows the mean of its forms' scores; `inspectionId` is the lead inspection.
   */
  async scores(visitIds: string[]): Promise<Map<string, { scorePct: number | null; submittedAt: Date | null; inspectionId: string }>> {
    const out = new Map<string, { scorePct: number | null; submittedAt: Date | null; inspectionId: string }>();
    if (!visitIds.length) return out;
    const rows = await raqibDb()
      .selectFrom("raqib_inspections")
      .select(["id", "visit_id", "score_pct", "submitted_at", "guard_form_version_id"])
      .where("visit_id", "in", visitIds)
      .orderBy(sql`guard_form_version_id is null`)
      .orderBy("started_at")
      .execute();
    const byVisit = new Map<string, typeof rows>();
    for (const r of rows) byVisit.set(r.visit_id, [...(byVisit.get(r.visit_id) ?? []), r]);
    for (const [visitId, group] of byVisit) {
      const scored = group.map((g) => g.score_pct).filter((n): n is number => n != null);
      out.set(visitId, {
        scorePct: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
        submittedAt: group.every((g) => g.submitted_at) ? group[0]!.submitted_at : null,
        inspectionId: group[0]!.id,
      });
    }
    return out;
  }

  // ── events ──────────────────────────────────────────────────────────────

  async appendEvent(e: {
    visitId: string;
    action: VisitEventRecord["action"];
    fromStatus: string | null;
    toStatus: string;
    actorId: string | null;
    actorNameAr: string;
    actorNameEn: string;
    actorRole: string | null;
    actorTitleAr: string;
    actorTitleEn: string;
    reason?: string | null;
    detail?: Record<string, unknown> | null;
    at?: Date;
  }): Promise<void> {
    await raqibDb()
      .insertInto("raqib_visit_events")
      .values({
        id: raqibId("vev"),
        organization_id: org(),
        visit_id: e.visitId,
        action: e.action as never,
        from_status: e.fromStatus,
        to_status: e.toStatus,
        actor_id: e.actorId,
        actor_name_ar: e.actorNameAr,
        actor_name_en: e.actorNameEn,
        actor_role: e.actorRole,
        actor_title_ar: e.actorTitleAr,
        actor_title_en: e.actorTitleEn,
        reason: e.reason ?? null,
        detail: (e.detail ?? null) as never,
        ...(e.at ? { at: e.at } : {}),
      })
      .execute();
  }

  async events(visitIds: string[]): Promise<Map<string, VisitEventRecord[]>> {
    const out = new Map<string, VisitEventRecord[]>();
    if (!visitIds.length) return out;
    const rows = await raqibDb().selectFrom("raqib_visit_events").selectAll().where("visit_id", "in", visitIds).orderBy("seq").execute();
    for (const r of rows) {
      const rec: VisitEventRecord = {
        id: r.id,
        visitId: r.visit_id,
        action: r.action,
        fromStatus: r.from_status,
        toStatus: r.to_status,
        actorId: r.actor_id,
        actorNameAr: r.actor_name_ar,
        actorNameEn: r.actor_name_en,
        actorRole: r.actor_role,
        actorTitleAr: r.actor_title_ar,
        actorTitleEn: r.actor_title_en,
        reason: r.reason,
        detail: (r.detail as Record<string, unknown> | null) ?? null,
        at: r.at,
      };
      out.set(r.visit_id, [...(out.get(r.visit_id) ?? []), rec]);
    }
    return out;
  }
}
