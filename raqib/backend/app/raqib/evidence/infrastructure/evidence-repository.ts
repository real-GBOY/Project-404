import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";

export type EvidenceKind = "photo" | "video" | "doc";
export type EvidenceContext = "answer" | "guard_eval" | "corrective_action" | "observation";

export interface EvidenceRecord {
  id: string;
  fileId: string;
  kind: EvidenceKind;
  name: string;
  mime: string;
  sizeBytes: number;
  context: EvidenceContext;
  inspectionId: string | null;
  itemId: string | null;
  guardId: string | null;
  refId: string | null;
  uploadedBy: string | null;
  uploadedAt: Date;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("evidence repository used outside a tenant context");
  return id;
};

type Row = {
  id: string; file_id: string; kind: EvidenceKind; name: string; mime: string; size_bytes: string | number; context: EvidenceContext;
  inspection_id: string | null; item_id: string | null; guard_id: string | null; ref_id: string | null; uploaded_by: string | null; uploaded_at: Date;
};
const toRecord = (r: Row): EvidenceRecord => ({
  id: r.id, fileId: r.file_id, kind: r.kind, name: r.name, mime: r.mime, sizeBytes: Number(r.size_bytes), context: r.context,
  inspectionId: r.inspection_id, itemId: r.item_id, guardId: r.guard_id, refId: r.ref_id, uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at,
});

@Injectable()
export class EvidenceRepository {
  async insert(e: Omit<EvidenceRecord, "id" | "uploadedAt">): Promise<string> {
    const id = raqibId("evd");
    await raqibDb()
      .insertInto("raqib_evidence")
      .values({
        id, organization_id: org(), file_id: e.fileId, kind: e.kind, name: e.name, mime: e.mime, size_bytes: e.sizeBytes as never, context: e.context,
        inspection_id: e.inspectionId, item_id: e.itemId, guard_id: e.guardId, ref_id: e.refId, uploaded_by: e.uploadedBy,
      })
      .execute();
    return id;
  }

  async find(id: string): Promise<EvidenceRecord | null> {
    const r = await raqibDb().selectFrom("raqib_evidence").selectAll().where("id", "=", id).where("removed_at", "is", null).executeTakeFirst();
    return r ? toRecord(r as Row) : null;
  }

  async forInspection(inspectionId: string): Promise<EvidenceRecord[]> {
    const rows = await raqibDb().selectFrom("raqib_evidence").selectAll().where("inspection_id", "=", inspectionId).where("removed_at", "is", null).orderBy("uploaded_at").execute();
    return rows.map((r) => toRecord(r as Row));
  }

  async forRef(context: EvidenceContext, refId: string): Promise<EvidenceRecord[]> {
    const rows = await raqibDb().selectFrom("raqib_evidence").selectAll().where("context", "=", context).where("ref_id", "=", refId).where("removed_at", "is", null).orderBy("uploaded_at").execute();
    return rows.map((r) => toRecord(r as Row));
  }

  async markRemoved(id: string): Promise<void> {
    await raqibDb().updateTable("raqib_evidence").set({ removed_at: sql`now()` as never }).where("id", "=", id).execute();
  }
}
