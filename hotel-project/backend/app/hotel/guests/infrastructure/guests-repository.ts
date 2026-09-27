import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";

export type IdDocumentType = "national_id" | "passport";

export interface GuestRecord {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  idDocumentType: IdDocumentType | null;
  idDocumentNumber: string | null;
  preferences: string | null;
  vip: boolean;
  createdAt: Date;
}

export interface GuestInput {
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  idDocumentType: IdDocumentType | null;
  idDocumentNumber: string | null;
  preferences: string | null;
  vip: boolean;
}

export interface GuestNote {
  id: string;
  body: string;
  authorId: string;
  createdAt: Date;
}

export interface GuestFilter {
  q?: string;
  vip?: boolean;
  page: number;
  pageSize: number;
}

@Injectable()
export class GuestsRepository {
  private org() {
    return requireOrganizationId();
  }

  async search(filter: GuestFilter): Promise<{ items: GuestRecord[]; total: number }> {
    let q = hotelDb().selectFrom("hotel_guests").where("organization_id", "=", this.org());
    if (filter.vip !== undefined) q = q.where("vip", "=", filter.vip);
    const term = filter.q?.trim();
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const digits = term.replace(/\D/g, "");
      q = q.where((eb) =>
        eb.or([
          eb("full_name", "ilike", like),
          eb("email", "ilike", like),
          ...(digits.length >= 3
            ? [eb(sql`regexp_replace(phone, '\\D', '', 'g')`, "like", `%${digits}%`)]
            : []),
        ]),
      );
    }
    const count = await q
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .executeTakeFirstOrThrow();
    const rows = await q
      .selectAll()
      .orderBy("full_name")
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize)
      .execute();
    return { items: rows.map((r) => this.toRecord(r)), total: Number(count.total) };
  }

  async findById(id: string): Promise<GuestRecord | null> {
    const row = await hotelDb()
      .selectFrom("hotel_guests")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRecord(row) : null;
  }

  async create(input: GuestInput, createdBy: string): Promise<string> {
    const id = hotelId("gst");
    await hotelDb()
      .insertInto("hotel_guests")
      .values({
        id,
        organization_id: this.org(),
        full_name: input.fullName,
        phone: input.phone,
        email: input.email,
        nationality: input.nationality,
        id_document_type: input.idDocumentType,
        id_document_number: input.idDocumentNumber,
        preferences: input.preferences,
        vip: input.vip,
        created_by: createdBy,
      })
      .execute();
    return id;
  }

  async update(id: string, patch: Partial<GuestInput>): Promise<void> {
    await hotelDb()
      .updateTable("hotel_guests")
      .set({
        ...(patch.fullName !== undefined && { full_name: patch.fullName }),
        ...(patch.phone !== undefined && { phone: patch.phone }),
        ...(patch.email !== undefined && { email: patch.email }),
        ...(patch.nationality !== undefined && { nationality: patch.nationality }),
        ...(patch.idDocumentType !== undefined && { id_document_type: patch.idDocumentType }),
        ...(patch.idDocumentNumber !== undefined && {
          id_document_number: patch.idDocumentNumber,
        }),
        ...(patch.preferences !== undefined && { preferences: patch.preferences }),
        ...(patch.vip !== undefined && { vip: patch.vip }),
      })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  async notes(guestId: string): Promise<GuestNote[]> {
    const rows = await hotelDb()
      .selectFrom("hotel_guest_notes")
      .select(["id", "body", "author_id", "created_at"])
      .where("organization_id", "=", this.org())
      .where("guest_id", "=", guestId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      authorId: r.author_id,
      createdAt: r.created_at,
    }));
  }

  async addNote(guestId: string, authorId: string, body: string): Promise<string> {
    const id = hotelId("gnt");
    await hotelDb()
      .insertInto("hotel_guest_notes")
      .values({ id, organization_id: this.org(), guest_id: guestId, author_id: authorId, body })
      .execute();
    return id;
  }

  private toRecord(r: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    id_document_type: IdDocumentType | null;
    id_document_number: string | null;
    preferences: string | null;
    vip: boolean;
    created_at: Date;
  }): GuestRecord {
    return {
      id: r.id,
      fullName: r.full_name,
      phone: r.phone,
      email: r.email,
      nationality: r.nationality,
      idDocumentType: r.id_document_type,
      idDocumentNumber: r.id_document_number,
      preferences: r.preferences,
      vip: r.vip,
      createdAt: r.created_at,
    };
  }
}
