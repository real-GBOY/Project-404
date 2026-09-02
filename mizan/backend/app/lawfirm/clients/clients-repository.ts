import { Injectable } from "@nestjs/common";
import { currentExecutor } from "../../../../../core/kernel/db/db.js";
import { requireOrganizationId } from "../../../../../core/kernel/tenant.js";
import { lawfirmId } from "../shared/ids.js";

export type ClientType = "company" | "individual";
export type ClientStatus = "active" | "archived";

export interface ClientRow {
  id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface ContactRow {
  id: string;
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  primary: boolean;
}

export interface ListClientsParams {
  q?: string;
  status: ClientStatus | "all";
  type: ClientType | "all";
  sort: "name" | "createdAt" | "-createdAt";
  page: number;
  pageSize: number;
}

export interface CreateClientInput {
  name: string;
  type: ClientType;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  notes?: string | null;
}

@Injectable()
export class ClientsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(p: ListClientsParams): Promise<{ rows: ClientRow[]; total: number }> {
    let q = currentExecutor()
      .selectFrom("lawfirm_clients")
      .selectAll()
      .where("organization_id", "=", this.org());

    if (p.status !== "all") q = q.where("status", "=", p.status);
    if (p.type !== "all") q = q.where("type", "=", p.type);
    if (p.q) {
      const like = `%${p.q.toLowerCase()}%`;
      q = q.where((eb) =>
        eb.or([
          eb(eb.fn("lower", ["name"]), "like", like),
          eb(eb.fn("lower", [eb.fn.coalesce("email", eb.val(""))]), "like", like),
        ]),
      );
    }

    const all = await q.execute();
    const sorted = [...all].sort((a, b) => {
      if (p.sort === "-createdAt") return b.created_at < a.created_at ? -1 : b.created_at > a.created_at ? 1 : 0;
      if (p.sort === "createdAt") return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
      return a.name.localeCompare(b.name);
    });
    const start = (p.page - 1) * p.pageSize;
    return {
      rows: sorted.slice(start, start + p.pageSize).map((r) => this.toRow(r)),
      total: sorted.length,
    };
  }

  async summaryCounts(): Promise<{ total: number; companies: number; individuals: number }> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_clients")
      .select(["type"])
      .where("organization_id", "=", this.org())
      .execute();
    return {
      total: rows.length,
      companies: rows.filter((r) => r.type === "company").length,
      individuals: rows.filter((r) => r.type === "individual").length,
    };
  }

  async allIds(): Promise<string[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_clients")
      .select(["id"])
      .where("organization_id", "=", this.org())
      .execute();
    return rows.map((r) => r.id);
  }

  async findById(id: string): Promise<ClientRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_clients")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateClientInput): Promise<ClientRow> {
    const id = lawfirmId("cli");
    await currentExecutor()
      .insertInto("lawfirm_clients")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        type: input.type,
        status: "active",
        email: input.email ?? null,
        phone: input.phone ?? null,
        tax_id: input.taxId ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<CreateClientInput> & { status?: ClientStatus },
  ): Promise<ClientRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.type !== undefined) set.type = patch.type;
    if (patch.email !== undefined) set.email = patch.email ?? null;
    if (patch.phone !== undefined) set.phone = patch.phone ?? null;
    if (patch.taxId !== undefined) set.tax_id = patch.taxId ?? null;
    if (patch.address !== undefined) set.address = patch.address ?? null;
    if (patch.notes !== undefined) set.notes = patch.notes ?? null;
    if (patch.status !== undefined) set.status = patch.status;
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_clients")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  // ─── contacts ──────────────────────────────────────────────────────────────
  async contacts(clientId: string): Promise<ContactRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_contacts")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .orderBy("is_primary", "desc")
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((r) => this.toContact(r));
  }

  async primaryContact(clientId: string): Promise<ContactRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_contacts")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .where("is_primary", "=", true)
      .executeTakeFirst();
    return row ? this.toContact(row) : null;
  }

  async clearPrimary(clientId: string): Promise<void> {
    await currentExecutor()
      .updateTable("lawfirm_contacts")
      .set({ is_primary: false })
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .execute();
  }

  async addContact(
    clientId: string,
    input: { name: string; role?: string | null; email?: string | null; phone?: string | null; primary?: boolean },
  ): Promise<ContactRow> {
    const id = lawfirmId("cnt");
    await currentExecutor()
      .insertInto("lawfirm_contacts")
      .values({
        id,
        organization_id: this.org(),
        client_id: clientId,
        name: input.name,
        role: input.role ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        is_primary: Boolean(input.primary),
      })
      .execute();
    const row = await currentExecutor()
      .selectFrom("lawfirm_contacts")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return this.toContact(row);
  }

  // ─── sibling reads for the client detail tabs ──────────────────────────────
  async mattersForClient(clientId: string): Promise<
    Array<{
      id: string;
      reference: string;
      title: string;
      practiceArea: string;
      court: string | null;
      leadLawyerId: string;
      status: "open" | "on_hold" | "closed";
      openedAt: Date;
    }>
  > {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["id", "reference", "title", "practice_area", "court", "lead_lawyer_id", "status", "opened_at"])
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .orderBy("opened_at", "desc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      practiceArea: r.practice_area,
      court: r.court,
      leadLawyerId: r.lead_lawyer_id,
      status: r.status,
      openedAt: new Date(r.opened_at),
    }));
  }

  async documentsForClient(clientId: string): Promise<
    Array<{ id: string; name: string; matterTitle: string | null; category: string; status: string; uploadedAt: Date }>
  > {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_documents")
      .innerJoin("lawfirm_matters", (join) =>
        join
          .onRef("lawfirm_matters.id", "=", "lawfirm_documents.matter_id")
          .onRef("lawfirm_matters.organization_id", "=", "lawfirm_documents.organization_id"),
      )
      .select([
        "lawfirm_documents.id as id",
        "lawfirm_documents.name as name",
        "lawfirm_matters.title as matterTitle",
        "lawfirm_documents.category as category",
        "lawfirm_documents.status as status",
        "lawfirm_documents.uploaded_at as uploadedAt",
      ])
      .where("lawfirm_documents.organization_id", "=", this.org())
      .where("lawfirm_matters.client_id", "=", clientId)
      .orderBy("lawfirm_documents.uploaded_at", "desc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      matterTitle: r.matterTitle,
      category: r.category,
      status: r.status,
      uploadedAt: new Date(r.uploadedAt),
    }));
  }

  async invoicesForClient(
    clientId: string,
  ): Promise<Array<{ id: string; number: string; status: string; currency: string; issuedAt: Date | null }>> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_invoices")
      .select(["id", "number", "status", "currency", "issued_at"])
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .orderBy("issued_at", "desc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      currency: r.currency,
      issuedAt: r.issued_at ? new Date(r.issued_at) : null,
    }));
  }

  private toRow(r: {
    id: string;
    name: string;
    type: ClientType;
    status: ClientStatus;
    email: string | null;
    phone: string | null;
    tax_id: string | null;
    address: string | null;
    notes: string | null;
    created_at: Date | string;
  }): ClientRow {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      status: r.status,
      email: r.email,
      phone: r.phone,
      taxId: r.tax_id,
      address: r.address,
      notes: r.notes,
      createdAt: new Date(r.created_at),
    };
  }

  private toContact(r: {
    id: string;
    client_id: string;
    name: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    is_primary: boolean;
  }): ContactRow {
    return {
      id: r.id,
      clientId: r.client_id,
      name: r.name,
      role: r.role,
      email: r.email,
      phone: r.phone,
      primary: r.is_primary,
    };
  }
}
