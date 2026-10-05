import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { fetchSize, type Page } from "@raqib/raqib/shared/paging.js";

export type Severity = "low" | "medium" | "high";
export type ObservationKind = "violation" | "observation";

export interface ObservationRecord {
  id: string;
  ref: string;
  kind: ObservationKind;
  projectId: string;
  siteId: string;
  visitId: string | null;
  inspectionId: string | null;
  itemId: string | null;
  itemKey: string | null;
  itemNum: string | null;
  title: L10n;
  note: string;
  severity: Severity;
  repeatCount: number;
  reportedBy: string | null;
  reportedByName: L10n;
  createdAt: Date;
}

export interface NewObservation {
  ref: string;
  kind: ObservationKind;
  projectId: string;
  siteId: string;
  visitId?: string | null;
  inspectionId?: string | null;
  itemId?: string | null;
  itemKey?: string | null;
  itemNum?: string | null;
  title: L10n;
  note: string;
  severity: Severity;
  repeatCount: number;
  reportedBy: string | null;
  reportedByName: L10n;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("observations repository used outside a tenant context");
  return id;
};

type Row = {
  id: string;
  ref: string;
  kind: ObservationKind;
  project_id: string;
  site_id: string;
  visit_id: string | null;
  inspection_id: string | null;
  item_id: string | null;
  item_key: string | null;
  item_num: string | null;
  title_ar: string;
  title_en: string;
  note: string;
  severity: Severity;
  repeat_count: number;
  reported_by: string | null;
  reported_by_name_ar: string;
  reported_by_name_en: string;
  created_at: Date;
};
const toRecord = (r: Row): ObservationRecord => ({
  id: r.id,
  ref: r.ref,
  kind: r.kind,
  projectId: r.project_id,
  siteId: r.site_id,
  visitId: r.visit_id,
  inspectionId: r.inspection_id,
  itemId: r.item_id,
  itemKey: r.item_key,
  itemNum: r.item_num,
  title: { ar: r.title_ar, en: r.title_en },
  note: r.note,
  severity: r.severity,
  repeatCount: r.repeat_count,
  reportedBy: r.reported_by,
  reportedByName: { ar: r.reported_by_name_ar, en: r.reported_by_name_en },
  createdAt: r.created_at,
});

@Injectable()
export class ObservationsRepository {
  async insert(o: NewObservation): Promise<string> {
    const id = raqibId("obs");
    await raqibDb()
      .insertInto("raqib_observations")
      .values({
        id,
        organization_id: org(),
        ref: o.ref,
        kind: o.kind,
        project_id: o.projectId,
        site_id: o.siteId,
        visit_id: o.visitId ?? null,
        inspection_id: o.inspectionId ?? null,
        item_id: o.itemId ?? null,
        item_key: o.itemKey ?? null,
        item_num: o.itemNum ?? null,
        title_ar: o.title.ar,
        title_en: o.title.en,
        note: o.note,
        severity: o.severity,
        repeat_count: o.repeatCount,
        reported_by: o.reportedBy,
        reported_by_name_ar: o.reportedByName.ar,
        reported_by_name_en: o.reportedByName.en,
      })
      .execute();
    return id;
  }

  async find(id: string): Promise<ObservationRecord | null> {
    const r = await raqibDb().selectFrom("raqib_observations").selectAll().where("id", "=", id).executeTakeFirst();
    return r ? toRecord(r as Row) : null;
  }

  async list(projectIds?: string[], page?: Page): Promise<ObservationRecord[]> {
    let q = raqibDb().selectFrom("raqib_observations").selectAll();
    if (projectIds) q = q.where("project_id", "in", projectIds.length ? projectIds : ["-"]);
    q = q.orderBy("created_at", "desc").orderBy("ref", "desc");
    if (page) q = q.limit(fetchSize(page)).offset(page.offset);
    return (await q.execute()).map((r) => toRecord(r as Row));
  }

  async forInspection(inspectionId: string): Promise<ObservationRecord[]> {
    const rows = await raqibDb().selectFrom("raqib_observations").selectAll().where("inspection_id", "=", inspectionId).orderBy("item_num").execute();
    return rows.map((r) => toRecord(r as Row));
  }

  async existingItemIds(inspectionId: string): Promise<Set<string>> {
    const rows = await raqibDb().selectFrom("raqib_observations").select("item_id").where("inspection_id", "=", inspectionId).execute();
    return new Set(rows.map((r) => r.item_id).filter((x): x is string => !!x));
  }

  /** The corrective action (if any) of each observation: a read-only summary for lists. */
  async actionSummaries(
    observationIds: string[],
  ): Promise<Map<string, { id: string; ref: string; status: string; dueDate: string; responsibleId: string; priority: string }>> {
    if (!observationIds.length) return new Map();
    const rows = await raqibDb()
      .selectFrom("raqib_corrective_actions")
      .select(["id", "ref", "status", sql<string>`due_date::text`.as("due_date"), "responsible_id", "priority", "observation_id"])
      .where("observation_id", "in", observationIds)
      .execute();
    return new Map(
      rows.map((r) => [
        r.observation_id,
        { id: r.id, ref: r.ref, status: r.status, dueDate: r.due_date, responsibleId: r.responsible_id, priority: r.priority },
      ]),
    );
  }

  /** Earlier findings of the same form item at the same site (the repeat count a new finding starts with). */
  async priorCount(siteId: string, itemKey: string): Promise<number> {
    const r = await raqibDb()
      .selectFrom("raqib_observations")
      .select(sql<number>`count(*)::int`.as("n"))
      .where("site_id", "=", siteId)
      .where("item_key", "=", itemKey)
      .executeTakeFirstOrThrow();
    return r.n;
  }
}
