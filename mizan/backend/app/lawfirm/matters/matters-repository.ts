import { Injectable } from "@nestjs/common";
import { currentExecutor } from "../../../../../core/kernel/db/db.js";
import { requireOrganizationId } from "../../../../../core/kernel/tenant.js";
import { lawfirmId } from "../shared/ids.js";

export type MatterStatus = "open" | "on_hold" | "closed";

export interface MatterRow {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  practiceArea: string;
  status: MatterStatus;
  court: string | null;
  leadLawyerId: string;
  openedAt: Date;
  closedAt: Date | null;
  description: string | null;
}

export interface ParticipantRow {
  id: string;
  matterId: string;
  userId: string;
  role: string;
}

export interface UpdateRow {
  id: string;
  matterId: string;
  authorId: string;
  body: string;
  documentIds: string[];
  createdAt: Date;
}

export interface NoteRow {
  id: string;
  matterId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListMattersParams {
  q?: string;
  status: MatterStatus | "all";
  practiceArea?: string;
  clientId?: string;
  sort: "openedAt" | "-openedAt";
  page: number;
  pageSize: number;
}

@Injectable()
export class MattersRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(p: ListMattersParams): Promise<{ rows: MatterRow[]; total: number }> {
    let q = currentExecutor()
      .selectFrom("lawfirm_matters")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (p.status !== "all") q = q.where("status", "=", p.status);
    if (p.practiceArea) q = q.where("practice_area", "=", p.practiceArea);
    if (p.clientId) q = q.where("client_id", "=", p.clientId);

    let rows = (await q.execute()).map((r) => this.toRow(r));
    if (p.q) {
      const needle = p.q.toLowerCase();
      const clientNames = await this.clientNameMap();
      rows = rows.filter((m) =>
        `${m.title} ${m.reference} ${clientNames.get(m.clientId) ?? ""}`.toLowerCase().includes(needle),
      );
    }
    rows.sort((a, b) =>
      p.sort === "openedAt"
        ? a.openedAt.getTime() - b.openedAt.getTime()
        : b.openedAt.getTime() - a.openedAt.getTime(),
    );
    const start = (p.page - 1) * p.pageSize;
    return { rows: rows.slice(start, start + p.pageSize), total: rows.length };
  }

  async allForSummary(): Promise<MatterRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .selectAll()
      .where("organization_id", "=", this.org())
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<MatterRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async nextReference(year: number): Promise<string> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select("reference")
      .where("organization_id", "=", this.org())
      .where("reference", "like", `TP-${year}-%`)
      .execute();
    return `TP-${year}-${String(rows.length + 1).padStart(4, "0")}`;
  }

  async create(input: {
    reference: string;
    title: string;
    clientId: string;
    practiceArea: string;
    court: string | null;
    leadLawyerId: string;
    description: string | null;
    openedAt: Date;
  }): Promise<MatterRow> {
    const id = lawfirmId("mat");
    await currentExecutor()
      .insertInto("lawfirm_matters")
      .values({
        id,
        organization_id: this.org(),
        reference: input.reference,
        title: input.title,
        client_id: input.clientId,
        practice_area: input.practiceArea,
        status: "open",
        court: input.court,
        lead_lawyer_id: input.leadLawyerId,
        opened_at: input.openedAt,
        description: input.description,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<{ title: string; practiceArea: string; court: string | null; description: string | null; clientId: string }>,
  ): Promise<MatterRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.practiceArea !== undefined) set.practice_area = patch.practiceArea;
    if (patch.court !== undefined) set.court = patch.court;
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.clientId !== undefined) set.client_id = patch.clientId;
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_matters")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  async close(id: string, at: Date): Promise<MatterRow | null> {
    await currentExecutor()
      .updateTable("lawfirm_matters")
      .set({ status: "closed", closed_at: at })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  // ─── participants ──────────────────────────────────────────────────────────
  async participants(matterId: string): Promise<ParticipantRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matter_participants")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((r) => ({ id: r.id, matterId: r.matter_id, userId: r.user_id, role: r.role }));
  }

  async addParticipant(matterId: string, userId: string, role: string): Promise<ParticipantRow> {
    const id = lawfirmId("mpt");
    await currentExecutor()
      .insertInto("lawfirm_matter_participants")
      .values({ id, organization_id: this.org(), matter_id: matterId, user_id: userId, role })
      .onConflict((oc) => oc.columns(["organization_id", "matter_id", "user_id"]).doUpdateSet({ role }))
      .execute();
    const row = await currentExecutor()
      .selectFrom("lawfirm_matter_participants")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();
    return { id: row.id, matterId: row.matter_id, userId: row.user_id, role: row.role };
  }

  async removeParticipant(matterId: string, participantId: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("lawfirm_matter_participants")
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .where("id", "=", participantId)
      .execute();
  }

  // ─── updates ───────────────────────────────────────────────────────────────
  async updates(matterId: string): Promise<UpdateRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matter_updates")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .orderBy("created_at", "desc")
      .execute();
    const files = rows.length
      ? await currentExecutor()
          .selectFrom("lawfirm_matter_update_files")
          .select(["matter_update_id", "document_id"])
          .where("organization_id", "=", this.org())
          .where("matter_update_id", "in", rows.map((r) => r.id))
          .execute()
      : [];
    return rows.map((r) => ({
      id: r.id,
      matterId: r.matter_id,
      authorId: r.author_id,
      body: r.body,
      documentIds: files.filter((f) => f.matter_update_id === r.id).map((f) => f.document_id),
      createdAt: new Date(r.created_at),
    }));
  }

  async addUpdate(matterId: string, authorId: string, body: string, documentIds: string[]): Promise<UpdateRow> {
    const id = lawfirmId("mup");
    await currentExecutor()
      .insertInto("lawfirm_matter_updates")
      .values({ id, organization_id: this.org(), matter_id: matterId, author_id: authorId, body })
      .execute();
    for (const documentId of documentIds) {
      await currentExecutor()
        .insertInto("lawfirm_matter_update_files")
        .values({ id: lawfirmId("muf"), organization_id: this.org(), matter_update_id: id, document_id: documentId })
        .execute();
    }
    return { id, matterId, authorId, body, documentIds, createdAt: new Date() };
  }

  // ─── notes ─────────────────────────────────────────────────────────────────
  async notes(matterId: string): Promise<NoteRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matter_notes")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((r) => this.toNote(r));
  }

  async findNote(matterId: string, noteId: string): Promise<NoteRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_matter_notes")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .where("id", "=", noteId)
      .executeTakeFirst();
    return row ? this.toNote(row) : null;
  }

  async addNote(matterId: string, authorId: string, body: string): Promise<NoteRow> {
    const id = lawfirmId("mnt");
    await currentExecutor()
      .insertInto("lawfirm_matter_notes")
      .values({ id, organization_id: this.org(), matter_id: matterId, author_id: authorId, body })
      .execute();
    return (await this.findNote(matterId, id))!;
  }

  async updateNote(matterId: string, noteId: string, body: string): Promise<NoteRow | null> {
    await currentExecutor()
      .updateTable("lawfirm_matter_notes")
      .set({ body })
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .where("id", "=", noteId)
      .execute();
    return this.findNote(matterId, noteId);
  }

  async deleteNote(matterId: string, noteId: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("lawfirm_matter_notes")
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .where("id", "=", noteId)
      .execute();
  }

  async invoicesForMatter(
    matterId: string,
  ): Promise<Array<{ id: string; number: string; status: string; currency: string }>> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_invoices")
      .select(["id", "number", "status", "currency"])
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .execute();
    return rows;
  }

  async expensesForMatter(matterId: string): Promise<Array<{ currency: string; amount: string }>> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_expenses")
      .select(["currency", "amount"])
      .where("organization_id", "=", this.org())
      .where("matter_id", "=", matterId)
      .execute();
    return rows;
  }

  async clientName(clientId: string): Promise<string> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_clients")
      .select("name")
      .where("organization_id", "=", this.org())
      .where("id", "=", clientId)
      .executeTakeFirst();
    return row?.name ?? "—";
  }

  async clientExists(clientId: string): Promise<boolean> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_clients")
      .select("id")
      .where("organization_id", "=", this.org())
      .where("id", "=", clientId)
      .executeTakeFirst();
    return row !== undefined;
  }

  async clientNameMap(): Promise<Map<string, string>> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_clients")
      .select(["id", "name"])
      .where("organization_id", "=", this.org())
      .execute();
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private toRow(r: {
    id: string;
    reference: string;
    title: string;
    client_id: string;
    practice_area: string;
    status: MatterStatus;
    court: string | null;
    lead_lawyer_id: string;
    opened_at: Date | string;
    closed_at: Date | string | null;
    description: string | null;
  }): MatterRow {
    return {
      id: r.id,
      reference: r.reference,
      title: r.title,
      clientId: r.client_id,
      practiceArea: r.practice_area,
      status: r.status,
      court: r.court,
      leadLawyerId: r.lead_lawyer_id,
      openedAt: new Date(r.opened_at),
      closedAt: r.closed_at ? new Date(r.closed_at) : null,
      description: r.description,
    };
  }

  private toNote(r: {
    id: string;
    matter_id: string;
    author_id: string;
    body: string;
    created_at: Date | string;
    updated_at: Date | string;
  }): NoteRow {
    return {
      id: r.id,
      matterId: r.matter_id,
      authorId: r.author_id,
      body: r.body,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }
}
