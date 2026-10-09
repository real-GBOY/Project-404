import { Injectable } from "@nestjs/common";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";

export type SurveyStatus = "draft" | "active" | "closed";
export interface SurveyQuestion {
  key: string;
  type: "rating" | "text";
  text: L10n;
}
export interface SurveyRecord {
  id: string;
  title: L10n;
  intro: L10n;
  questions: SurveyQuestion[];
  status: SurveyStatus;
  createdBy: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  closedAt: Date | null;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("surveys repository used outside a tenant context");
  return id;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRecord = (r: any): SurveyRecord => ({
  id: r.id,
  title: { ar: r.title_ar, en: r.title_en },
  intro: { ar: r.intro_ar, en: r.intro_en },
  questions: r.questions as SurveyQuestion[],
  status: r.status,
  createdBy: r.created_by,
  createdAt: r.created_at,
  publishedAt: r.published_at,
  closedAt: r.closed_at,
});

@Injectable()
export class SurveysRepository {
  async insert(s: { title: L10n; intro: L10n; questions: SurveyQuestion[]; createdBy: string }): Promise<string> {
    const id = raqibId("svy");
    await raqibDb()
      .insertInto("raqib_surveys")
      .values({
        id,
        organization_id: org(),
        title_ar: s.title.ar,
        title_en: s.title.en,
        intro_ar: s.intro.ar,
        intro_en: s.intro.en,
        questions: JSON.stringify(s.questions) as never,
        created_by: s.createdBy,
      })
      .execute();
    return id;
  }

  async list(statuses?: SurveyStatus[]): Promise<SurveyRecord[]> {
    let q = raqibDb().selectFrom("raqib_surveys").selectAll();
    if (statuses) q = q.where("status", "in", statuses);
    return (await q.orderBy("created_at", "desc").execute()).map(toRecord);
  }

  async find(id: string, lock = false): Promise<SurveyRecord | null> {
    let q = raqibDb().selectFrom("raqib_surveys").selectAll().where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toRecord(r) : null;
  }

  async setStatus(id: string, status: SurveyStatus, at: Date): Promise<void> {
    await raqibDb()
      .updateTable("raqib_surveys")
      .set({ status, ...(status === "active" ? { published_at: at } : {}), ...(status === "closed" ? { closed_at: at } : {}) })
      .where("id", "=", id)
      .execute();
  }
}
