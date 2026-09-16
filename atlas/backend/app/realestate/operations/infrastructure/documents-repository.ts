import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type DocumentStatus = "draft" | "pending" | "verified";

export interface DocumentRow {
  id: string;
  name: string;
  docType: string;
  relatedType: string | null;
  relatedId: string | null;
  fileId: string | null;
  uploadedBy: string;
  status: DocumentStatus;
  createdAt: Date;
}

export interface CreateDocumentInput {
  name: string;
  docType: string;
  relatedType?: string | null;
  relatedId?: string | null;
  fileId?: string | null;
  uploadedBy: string;
}

@Injectable()
export class DocumentsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(relatedType?: string, relatedId?: string): Promise<DocumentRow[]> {
    let q = realestateDb().selectFrom("realestate_documents").selectAll().where("organization_id", "=", this.org());
    if (relatedType) q = q.where("related_type", "=", relatedType);
    if (relatedId) q = q.where("related_id", "=", relatedId);
    const rows = await q.orderBy("created_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async create(input: CreateDocumentInput): Promise<DocumentRow> {
    const id = realestateId("doc");
    await realestateDb()
      .insertInto("realestate_documents")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        doc_type: input.docType,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
        file_id: input.fileId ?? null,
        uploaded_by: input.uploadedBy,
        status: "pending",
      })
      .execute();
    const row = await realestateDb()
      .selectFrom("realestate_documents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return this.toRow(row);
  }

  private toRow(r: {
    id: string;
    name: string;
    doc_type: string;
    related_type: string | null;
    related_id: string | null;
    file_id: string | null;
    uploaded_by: string;
    status: DocumentStatus;
    created_at: Date | string;
  }): DocumentRow {
    return {
      id: r.id,
      name: r.name,
      docType: r.doc_type,
      relatedType: r.related_type,
      relatedId: r.related_id,
      fileId: r.file_id,
      uploadedBy: r.uploaded_by,
      status: r.status,
      createdAt: new Date(r.created_at),
    };
  }
}
