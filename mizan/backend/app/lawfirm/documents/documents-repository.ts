import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";

export type DocumentStatus = "draft" | "final" | "filed" | "signed";

export interface DocumentRow {
  id: string;
  name: string;
  matterId: string | null;
  category: string;
  status: DocumentStatus;
  fileId: string;
  sizeBytes: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: Date;
}

@Injectable()
export class DocumentsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: { matterId?: string; q?: string; category?: string; status?: DocumentStatus }): Promise<DocumentRow[]> {
    let q = currentExecutor()
      .selectFrom("lawfirm_documents")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (filter.matterId) q = q.where("matter_id", "=", filter.matterId);
    if (filter.category) q = q.where("category", "=", filter.category);
    if (filter.status) q = q.where("status", "=", filter.status);
    let rows = (await q.orderBy("uploaded_at", "desc").execute()).map((r) => this.toRow(r));
    if (filter.q) {
      const needle = filter.q.toLowerCase();
      rows = rows.filter((d) => d.name.toLowerCase().includes(needle));
    }
    return rows;
  }

  async all(): Promise<DocumentRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_documents")
      .selectAll()
      .where("organization_id", "=", this.org())
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<DocumentRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_documents")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: {
    name: string;
    matterId: string | null;
    category: string;
    fileId: string;
    sizeBytes: number;
    mimeType: string;
    uploadedById: string;
  }): Promise<DocumentRow> {
    const id = lawfirmId("cdoc");
    await currentExecutor()
      .insertInto("lawfirm_documents")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        matter_id: input.matterId,
        category: input.category,
        status: "draft",
        file_id: input.fileId,
        size_bytes: input.sizeBytes,
        mime_type: input.mimeType,
        uploaded_by_id: input.uploadedById,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<{ name: string; category: string; status: DocumentStatus }>,
  ): Promise<DocumentRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.status !== undefined) set.status = patch.status;
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_documents")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("lawfirm_documents")
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  async matterContext(matterId: string): Promise<{ title: string; reference: string } | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["title", "reference"])
      .where("organization_id", "=", this.org())
      .where("id", "=", matterId)
      .executeTakeFirst();
    return row ?? null;
  }

  private toRow(r: {
    id: string;
    name: string;
    matter_id: string | null;
    category: string;
    status: DocumentStatus;
    file_id: string;
    size_bytes: number | string;
    mime_type: string;
    uploaded_by_id: string;
    uploaded_at: Date | string;
  }): DocumentRow {
    return {
      id: r.id,
      name: r.name,
      matterId: r.matter_id,
      category: r.category,
      status: r.status,
      fileId: r.file_id,
      sizeBytes: Number(r.size_bytes),
      mimeType: r.mime_type,
      uploadedById: r.uploaded_by_id,
      uploadedAt: new Date(r.uploaded_at),
    };
  }
}
