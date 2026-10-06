import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import type { Answer } from "../domain/scoring.js";

export interface InspectionRecord {
  id: string;
  visitId: string;
  formVersionId: string;
  guardFormVersionId: string | null;
  scoringPolicy: string;
  startedBy: string | null;
  startedAt: Date;
  submittedAt: Date | null;
  scorePct: number | null;
  counts: Record<string, number> | null;
}
export interface ItemRecord {
  id: string;
  inspectionId: string;
  kind: "site" | "guard";
  sectionPos: number;
  sectionKey: string;
  sectionTitle: L10n;
  position: number;
  key: string;
  text: L10n;
  weight: number;
  answerType: string;
  required: boolean;
  na: boolean;
  evidenceOnNc: boolean;
}
export type NewItem = Omit<ItemRecord, "id" | "inspectionId">;
export interface AnswerRecord {
  id: string;
  itemId: string;
  value: Answer;
  note: string | null;
  severity: "low" | "medium" | "high" | null;
  editedRound: number;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("inspections repository used outside a tenant context");
  return id;
};

@Injectable()
export class InspectionsRepository {
  private toInspection(r: {
    id: string;
    visit_id: string;
    form_version_id: string;
    guard_form_version_id: string | null;
    scoring_policy: string;
    started_by: string | null;
    started_at: Date;
    submitted_at: Date | null;
    score_pct: number | null;
    counts: unknown;
  }): InspectionRecord {
    return {
      id: r.id,
      visitId: r.visit_id,
      formVersionId: r.form_version_id,
      guardFormVersionId: r.guard_form_version_id,
      scoringPolicy: r.scoring_policy,
      startedBy: r.started_by,
      startedAt: r.started_at,
      submittedAt: r.submitted_at,
      scorePct: r.score_pct,
      counts: (r.counts as Record<string, number> | null) ?? null,
    };
  }

  async findByVisit(visitId: string, lock = false): Promise<InspectionRecord | null> {
    let q = raqibDb().selectFrom("raqib_inspections").selectAll().where("visit_id", "=", visitId);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? this.toInspection(r) : null;
  }

  async find(id: string): Promise<InspectionRecord | null> {
    const r = await raqibDb().selectFrom("raqib_inspections").selectAll().where("id", "=", id).executeTakeFirst();
    return r ? this.toInspection(r) : null;
  }

  async byVisits(visitIds: string[]): Promise<InspectionRecord[]> {
    if (!visitIds.length) return [];
    return (await raqibDb().selectFrom("raqib_inspections").selectAll().where("visit_id", "in", visitIds).execute()).map((r) => this.toInspection(r));
  }

  async insert(i: { visitId: string; formVersionId: string; guardFormVersionId: string | null; scoringPolicy: string; startedBy: string }): Promise<string> {
    const id = raqibId("ins");
    await raqibDb()
      .insertInto("raqib_inspections")
      .values({
        id,
        organization_id: org(),
        visit_id: i.visitId,
        form_version_id: i.formVersionId,
        guard_form_version_id: i.guardFormVersionId,
        scoring_policy: i.scoringPolicy,
        started_by: i.startedBy,
      })
      .execute();
    return id;
  }

  async insertItems(inspectionId: string, items: NewItem[]): Promise<void> {
    if (!items.length) return;
    await raqibDb()
      .insertInto("raqib_inspection_items")
      .values(
        items.map((it) => ({
          id: raqibId("iit"),
          organization_id: org(),
          inspection_id: inspectionId,
          kind: it.kind,
          section_pos: it.sectionPos,
          section_key: it.sectionKey,
          section_title_ar: it.sectionTitle.ar,
          section_title_en: it.sectionTitle.en,
          position: it.position,
          item_key: it.key,
          text_ar: it.text.ar,
          text_en: it.text.en,
          weight: it.weight,
          answer_type: it.answerType,
          required: it.required,
          na_allowed: it.na,
          evidence_on_nc: it.evidenceOnNc,
        })),
      )
      .execute();
  }

  async items(inspectionId: string): Promise<ItemRecord[]> {
    const rows = await raqibDb()
      .selectFrom("raqib_inspection_items")
      .selectAll()
      .where("inspection_id", "=", inspectionId)
      .orderBy("kind")
      .orderBy("section_pos")
      .orderBy("position")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      inspectionId: r.inspection_id,
      kind: r.kind,
      sectionPos: r.section_pos,
      sectionKey: r.section_key,
      sectionTitle: { ar: r.section_title_ar, en: r.section_title_en },
      position: r.position,
      key: r.item_key,
      text: { ar: r.text_ar, en: r.text_en },
      weight: r.weight,
      answerType: r.answer_type,
      required: r.required,
      na: r.na_allowed,
      evidenceOnNc: r.evidence_on_nc,
    }));
  }

  async answers(inspectionId: string): Promise<Map<string, AnswerRecord>> {
    const rows = await raqibDb().selectFrom("raqib_answers").selectAll().where("inspection_id", "=", inspectionId).execute();
    return new Map(
      rows.map((r) => [r.item_id, { id: r.id, itemId: r.item_id, value: r.value, note: r.note, severity: r.severity, editedRound: r.edited_round }]),
    );
  }

  async upsertAnswer(
    inspectionId: string,
    itemId: string,
    patch: { value?: Answer; note?: string | null; severity?: "low" | "medium" | "high" | null },
    round: number,
    userId: string,
  ): Promise<void> {
    const existing = await raqibDb().selectFrom("raqib_answers").select("id").where("item_id", "=", itemId).executeTakeFirst();
    const set: Record<string, unknown> = { edited_round: round, updated_by: userId, updated_at: sql`now()` };
    if (patch.value !== undefined) set.value = patch.value;
    if (patch.note !== undefined) set.note = patch.note;
    if (patch.severity !== undefined) set.severity = patch.severity;
    if (existing) {
      await raqibDb()
        .updateTable("raqib_answers")
        .set(set as never)
        .where("item_id", "=", itemId)
        .execute();
      return;
    }
    await raqibDb()
      .insertInto("raqib_answers")
      .values({
        id: raqibId("ans"),
        organization_id: org(),
        inspection_id: inspectionId,
        item_id: itemId,
        value: patch.value ?? null,
        note: patch.note ?? null,
        severity: patch.severity ?? null,
        edited_round: round,
        updated_by: userId,
      })
      .execute();
  }

  // ── guard evaluation ────────────────────────────────────────────────────

  async guardScores(inspectionId: string): Promise<Array<{ guardId: string; itemId: string; score: number }>> {
    const rows = await raqibDb().selectFrom("raqib_guard_scores").select(["guard_id", "item_id", "score"]).where("inspection_id", "=", inspectionId).execute();
    return rows.map((r) => ({ guardId: r.guard_id, itemId: r.item_id, score: r.score }));
  }

  async setGuardScore(inspectionId: string, guardId: string, itemId: string, score: number): Promise<void> {
    await raqibDb()
      .insertInto("raqib_guard_scores")
      .values({ organization_id: org(), inspection_id: inspectionId, guard_id: guardId, item_id: itemId, score })
      .onConflict((oc) => oc.columns(["organization_id", "inspection_id", "guard_id", "item_id"]).doUpdateSet({ score, updated_at: sql`now()` as never }))
      .execute();
  }

  async guardNotes(inspectionId: string): Promise<Map<string, string>> {
    const rows = await raqibDb().selectFrom("raqib_guard_notes").select(["guard_id", "note"]).where("inspection_id", "=", inspectionId).execute();
    return new Map(rows.map((r) => [r.guard_id, r.note]));
  }

  async setGuardNote(inspectionId: string, guardId: string, note: string): Promise<void> {
    await raqibDb()
      .insertInto("raqib_guard_notes")
      .values({ organization_id: org(), inspection_id: inspectionId, guard_id: guardId, note })
      .onConflict((oc) => oc.columns(["organization_id", "inspection_id", "guard_id"]).doUpdateSet({ note, updated_at: sql`now()` as never }))
      .execute();
  }

  // ── flags (written by the review workflow) ──────────────────────────────

  async flags(inspectionId: string): Promise<Array<{ itemId: string; round: number }>> {
    const rows = await raqibDb().selectFrom("raqib_inspection_flags").select(["item_id", "round"]).where("inspection_id", "=", inspectionId).execute();
    return rows.map((r) => ({ itemId: r.item_id, round: r.round }));
  }

  async addFlags(inspectionId: string, itemIds: string[], round: number, by: string): Promise<void> {
    if (!itemIds.length) return;
    await raqibDb()
      .insertInto("raqib_inspection_flags")
      .values(itemIds.map((itemId) => ({ id: raqibId("dec"), organization_id: org(), inspection_id: inspectionId, item_id: itemId, round, created_by: by })))
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async markSubmitted(inspectionId: string, scorePct: number | null, counts: Record<string, number>, at: Date): Promise<void> {
    await raqibDb()
      .updateTable("raqib_inspections")
      .set({ submitted_at: at, score_pct: scorePct, counts: JSON.stringify(counts) as never })
      .where("id", "=", inspectionId)
      .execute();
  }
}
