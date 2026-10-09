import { Injectable } from "@nestjs/common";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";

export type CorrectionField = "started_at" | "submitted_at" | "deduction_amount";

export interface CorrectionRecord {
  id: string;
  inspectionId: string;
  visitId: string;
  field: CorrectionField;
  itemKey: string | null;
  previousValue: string | null;
  newValue: string;
  reason: string;
  actor: { id: string | null; nameAr: string; nameEn: string; role: string | null };
  at: Date;
}

export interface NewCorrection {
  inspectionId: string;
  visitId: string;
  projectId: string;
  field: CorrectionField;
  itemKey?: string | null;
  previousValue: string | null;
  newValue: string;
  reason: string;
  actor: { id: string | null; nameAr: string; nameEn: string; role: string | null };
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("corrections repository used outside a tenant context");
  return id;
};

@Injectable()
export class CorrectionsRepository {
  async insert(c: NewCorrection): Promise<string> {
    const id = raqibId("cor");
    await raqibDb()
      .insertInto("raqib_corrections")
      .values({
        id,
        organization_id: org(),
        inspection_id: c.inspectionId,
        visit_id: c.visitId,
        project_id: c.projectId,
        field: c.field,
        item_key: c.itemKey ?? null,
        previous_value: c.previousValue,
        new_value: c.newValue,
        reason: c.reason,
        actor_id: c.actor.id,
        actor_name_ar: c.actor.nameAr,
        actor_name_en: c.actor.nameEn,
        actor_role: c.actor.role,
      })
      .execute();
    return id;
  }

  async forInspection(inspectionId: string): Promise<CorrectionRecord[]> {
    const rows = await raqibDb().selectFrom("raqib_corrections").selectAll().where("inspection_id", "=", inspectionId).orderBy("seq").execute();
    return rows.map((r) => ({
      id: r.id,
      inspectionId: r.inspection_id,
      visitId: r.visit_id,
      field: r.field,
      itemKey: r.item_key,
      previousValue: r.previous_value,
      newValue: r.new_value,
      reason: r.reason,
      actor: { id: r.actor_id, nameAr: r.actor_name_ar, nameEn: r.actor_name_en, role: r.actor_role },
      at: r.at,
    }));
  }
}
