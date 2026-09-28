import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";

export type DocumentKind = "id_document" | "other";

export interface GuestDocumentRecord {
  id: string;
  guestId: string;
  fileId: string;
  kind: DocumentKind;
  label: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

/** Links between guests and files held by Core's files module. */
@Injectable()
export class GuestDocumentsRepository {
  private org() {
    return requireOrganizationId();
  }

  async list(guestId: string): Promise<GuestDocumentRecord[]> {
    const rows = await hotelDb()
      .selectFrom("hotel_guest_documents")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("guest_id", "=", guestId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((r) => this.toRecord(r));
  }

  async find(guestId: string, id: string): Promise<GuestDocumentRecord | null> {
    const row = await hotelDb()
      .selectFrom("hotel_guest_documents")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("guest_id", "=", guestId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRecord(row) : null;
  }

  async insert(d: {
    guestId: string;
    fileId: string;
    kind: DocumentKind;
    label: string | null;
    uploadedBy: string;
  }): Promise<string> {
    const id = hotelId("gdc");
    await hotelDb()
      .insertInto("hotel_guest_documents")
      .values({
        id,
        organization_id: this.org(),
        guest_id: d.guestId,
        file_id: d.fileId,
        kind: d.kind,
        label: d.label,
        uploaded_by: d.uploadedBy,
      })
      .execute();
    return id;
  }

  async delete(id: string): Promise<void> {
    await hotelDb()
      .deleteFrom("hotel_guest_documents")
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  private toRecord(r: {
    id: string;
    guest_id: string;
    file_id: string;
    kind: DocumentKind;
    label: string | null;
    uploaded_by: string | null;
    created_at: Date;
  }): GuestDocumentRecord {
    return {
      id: r.id,
      guestId: r.guest_id,
      fileId: r.file_id,
      kind: r.kind,
      label: r.label,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
    };
  }
}
