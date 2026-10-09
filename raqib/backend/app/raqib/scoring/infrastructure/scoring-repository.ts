import { Injectable } from "@nestjs/common";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { Deduction, DeductionConfig } from "@raqib/raqib/inspections/domain/scoring.js";

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("scoring repository used outside a tenant context");
  return id;
};

export interface ScoringConfigRecord extends DeductionConfig {
  reason: string;
  createdBy: string | null;
  createdAt: Date;
}

@Injectable()
export class ScoringRepository {
  private toConfig(r: {
    id: string;
    version: number;
    base_score: number;
    by_severity: Record<string, number>;
    by_item: Record<string, number>;
    reason: string;
    created_by: string | null;
    created_at: Date;
  }): ScoringConfigRecord {
    return {
      id: r.id,
      version: r.version,
      base: r.base_score,
      bySeverity: r.by_severity,
      byItem: r.by_item,
      reason: r.reason,
      createdBy: r.created_by,
      createdAt: r.created_at,
    };
  }

  async latest(): Promise<ScoringConfigRecord | null> {
    const r = await raqibDb().selectFrom("raqib_scoring_configs").selectAll().orderBy("version", "desc").limit(1).executeTakeFirst();
    return r ? this.toConfig(r) : null;
  }

  async byId(id: string): Promise<ScoringConfigRecord | null> {
    const r = await raqibDb().selectFrom("raqib_scoring_configs").selectAll().where("id", "=", id).executeTakeFirst();
    return r ? this.toConfig(r) : null;
  }

  async history(): Promise<ScoringConfigRecord[]> {
    return (await raqibDb().selectFrom("raqib_scoring_configs").selectAll().orderBy("version", "desc").execute()).map((r) => this.toConfig(r));
  }

  /** Publishes the next version (the unique (organization, version) key turns a lost race into a conflict). */
  async insert(c: {
    base: number;
    bySeverity: Record<string, number>;
    byItem: Record<string, number>;
    reason: string;
    createdBy: string;
  }): Promise<ScoringConfigRecord> {
    const last = await this.latest();
    const id = raqibId("scf");
    await raqibDb()
      .insertInto("raqib_scoring_configs")
      .values({
        id,
        organization_id: org(),
        version: (last?.version ?? 0) + 1,
        base_score: c.base,
        by_severity: JSON.stringify(c.bySeverity) as never,
        by_item: JSON.stringify(c.byItem) as never,
        reason: c.reason,
        created_by: c.createdBy,
      })
      .execute();
    return (await this.byId(id))!;
  }

  // ── deductions (one per recorded violation) ─────────────────────────────

  /** Replaces the inspection's deductions with the freshly computed set (a resubmission may change its answers). */
  async replaceDeductions(inspectionId: string, configId: string, rows: Deduction[]): Promise<void> {
    await raqibDb().deleteFrom("raqib_inspection_deductions").where("inspection_id", "=", inspectionId).execute();
    if (!rows.length) return;
    await raqibDb()
      .insertInto("raqib_inspection_deductions")
      .values(
        rows.map((d) => ({
          organization_id: org(),
          inspection_id: inspectionId,
          item_id: d.itemId,
          item_key: d.itemKey,
          severity: d.severity,
          amount: d.amount,
          config_id: configId,
        })),
      )
      .execute();
  }

  async deductionsOf(inspectionId: string): Promise<Deduction[]> {
    const rows = await raqibDb().selectFrom("raqib_inspection_deductions").selectAll().where("inspection_id", "=", inspectionId).orderBy("item_key").execute();
    return rows.map((r) => ({ itemId: r.item_id, itemKey: r.item_key, severity: r.severity, amount: r.amount }));
  }

  async setDeductionAmount(inspectionId: string, itemKey: string, amount: number): Promise<number> {
    const r = await raqibDb()
      .updateTable("raqib_inspection_deductions")
      .set({ amount })
      .where("inspection_id", "=", inspectionId)
      .where("item_key", "=", itemKey)
      .executeTakeFirst();
    return Number(r.numUpdatedRows);
  }

  // ── designations ────────────────────────────────────────────────────────

  async designees(kind: "scoring_admin" | "survey_manager"): Promise<Array<{ userId: string; grantedBy: string | null; at: Date }>> {
    const rows = await raqibDb().selectFrom("raqib_designations").selectAll().where("kind", "=", kind).orderBy("created_at").execute();
    return rows.map((r) => ({ userId: r.user_id, grantedBy: r.granted_by, at: r.created_at }));
  }

  async isDesignee(userId: string, kind: "scoring_admin" | "survey_manager"): Promise<boolean> {
    return !!(await raqibDb().selectFrom("raqib_designations").select("user_id").where("user_id", "=", userId).where("kind", "=", kind).executeTakeFirst());
  }

  async addDesignee(userId: string, kind: "scoring_admin" | "survey_manager", by: string): Promise<boolean> {
    const r = await raqibDb()
      .insertInto("raqib_designations")
      .values({ organization_id: org(), user_id: userId, kind, granted_by: by })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst();
    return Number(r.numInsertedOrUpdatedRows ?? 0) > 0;
  }

  async removeDesignee(userId: string, kind: "scoring_admin" | "survey_manager"): Promise<boolean> {
    const r = await raqibDb().deleteFrom("raqib_designations").where("user_id", "=", userId).where("kind", "=", kind).executeTakeFirst();
    return Number(r.numDeletedRows) > 0;
  }
}
