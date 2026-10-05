import { Injectable } from "@nestjs/common";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { ReportSnapshot } from "../domain/report-snapshot.js";
import { fetchSize, type Page } from "@raqib/raqib/shared/paging.js";

export interface ReportRecord {
  id: string;
  visitId: string;
  inspectionId: string;
  projectId: string;
  ref: string;
  scorePct: number | null;
  approvedBy: string | null;
  generatedAt: Date;
  snapshot: ReportSnapshot;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("reports repository used outside a tenant context");
  return id;
};

type Row = {
  id: string;
  visit_id: string;
  inspection_id: string;
  project_id: string;
  ref: string;
  score_pct: number | null;
  approved_by: string | null;
  generated_at: Date;
  snapshot: unknown;
};
const toRecord = (r: Row): ReportRecord => ({
  id: r.id,
  visitId: r.visit_id,
  inspectionId: r.inspection_id,
  projectId: r.project_id,
  ref: r.ref,
  scorePct: r.score_pct,
  approvedBy: r.approved_by,
  generatedAt: r.generated_at,
  snapshot: r.snapshot as ReportSnapshot,
});

@Injectable()
export class ReportsRepository {
  async insert(r: Omit<ReportRecord, "id" | "generatedAt"> & { approvedByNameAr: string; approvedByNameEn: string }): Promise<string> {
    const id = raqibId("rep");
    await raqibDb()
      .insertInto("raqib_reports")
      .values({
        id,
        organization_id: org(),
        visit_id: r.visitId,
        inspection_id: r.inspectionId,
        project_id: r.projectId,
        ref: r.ref,
        score_pct: r.scorePct,
        snapshot: JSON.stringify(r.snapshot) as never,
        approved_by: r.approvedBy,
        approved_by_name_ar: r.approvedByNameAr,
        approved_by_name_en: r.approvedByNameEn,
      })
      .execute();
    return id;
  }

  async find(id: string): Promise<ReportRecord | null> {
    const r = await raqibDb().selectFrom("raqib_reports").selectAll().where("id", "=", id).executeTakeFirst();
    return r ? toRecord(r as Row) : null;
  }

  async findByVisit(visitId: string): Promise<ReportRecord | null> {
    const r = await raqibDb().selectFrom("raqib_reports").selectAll().where("visit_id", "=", visitId).executeTakeFirst();
    return r ? toRecord(r as Row) : null;
  }

  async list(projectIds?: string[], page?: Page): Promise<ReportRecord[]> {
    let q = raqibDb().selectFrom("raqib_reports").selectAll();
    if (projectIds) q = q.where("project_id", "in", projectIds.length ? projectIds : ["-"]);
    q = q.orderBy("generated_at", "desc").orderBy("id", "desc");
    if (page) q = q.limit(fetchSize(page)).offset(page.offset);
    return (await q.execute()).map((r) => toRecord(r as Row));
  }
}
