import { Injectable } from "@nestjs/common";
import { currentExecutor } from "../../../../../core/kernel/db/db.js";
import { requireOrganizationId } from "../../../../../core/kernel/tenant.js";
import { lawfirmId } from "../shared/ids.js";
import { decimal } from "../shared/money.js";

export type InvoiceStatus = "draft" | "issued" | "sent" | "paid" | "void";
export type Currency = "EGP" | "AED" | "USD" | "SAR";
export type LineKind = "fee" | "disbursement";
export type PaymentMethod = "bank_transfer" | "cheque" | "cash" | "card";
export type ExpenseStatus = "pending" | "approved" | "rejected";

export interface InvoiceLineRow {
  id: string;
  kind: LineKind;
  description: string;
  amount: number;
}

export interface InvoiceRow {
  id: string;
  number: string;
  clientId: string;
  matterId: string | null;
  status: InvoiceStatus;
  currency: Currency;
  issuedAt: Date | null;
  dueAt: Date | null;
  vatRate: number;
  lines: InvoiceLineRow[];
}

export interface PaymentRow {
  id: string;
  invoiceId: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  receivedAt: Date;
  reference: string | null;
}

export interface ExpenseRow {
  id: string;
  matterId: string | null;
  description: string;
  category: string;
  amount: number;
  currency: Currency;
  status: ExpenseStatus;
  incurredAt: Date;
  submittedById: string;
}

@Injectable()
export class BillingRepository {
  private org(): string {
    return requireOrganizationId();
  }

  // ─── invoices ──────────────────────────────────────────────────────────────
  async invoices(filter: { status?: InvoiceStatus; clientId?: string } = {}): Promise<InvoiceRow[]> {
    let q = currentExecutor()
      .selectFrom("lawfirm_invoices")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (filter.status) q = q.where("status", "=", filter.status);
    if (filter.clientId) q = q.where("client_id", "=", filter.clientId);
    const rows = await q.execute();
    return this.hydrate(rows);
  }

  async invoiceById(id: string): Promise<InvoiceRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_invoices")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return (await this.hydrate([row]))[0];
  }

  async nextInvoiceNumber(year: number): Promise<string> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_invoices")
      .select("id")
      .where("organization_id", "=", this.org())
      .execute();
    return `INV-${year}-${String(rows.length + 129).padStart(4, "0")}`;
  }

  async createInvoice(input: {
    number: string;
    clientId: string;
    matterId: string | null;
    currency: Currency;
    vatRate: number;
    lines: Array<{ kind: LineKind; description: string; amount: number }>;
  }): Promise<InvoiceRow> {
    const id = lawfirmId("inv");
    await currentExecutor()
      .insertInto("lawfirm_invoices")
      .values({
        id,
        organization_id: this.org(),
        number: input.number,
        client_id: input.clientId,
        matter_id: input.matterId,
        status: "draft",
        currency: input.currency,
        vat_rate: String(input.vatRate),
      })
      .execute();
    await this.replaceLines(id, input.lines);
    return (await this.invoiceById(id))!;
  }

  async replaceLines(
    invoiceId: string,
    lines: Array<{ kind: LineKind; description: string; amount: number }>,
  ): Promise<void> {
    await currentExecutor()
      .deleteFrom("lawfirm_invoice_lines")
      .where("organization_id", "=", this.org())
      .where("invoice_id", "=", invoiceId)
      .execute();
    for (const l of lines) {
      await currentExecutor()
        .insertInto("lawfirm_invoice_lines")
        .values({
          id: lawfirmId("ifl"),
          organization_id: this.org(),
          invoice_id: invoiceId,
          kind: l.kind,
          description: l.description,
          amount: String(l.amount),
        })
        .execute();
    }
  }

  async updateInvoice(
    id: string,
    patch: Partial<{ status: InvoiceStatus; issuedAt: Date | null; dueAt: Date | null; vatRate: number }>,
  ): Promise<InvoiceRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.issuedAt !== undefined) set.issued_at = patch.issuedAt;
    if (patch.dueAt !== undefined) set.due_at = patch.dueAt;
    if (patch.vatRate !== undefined) set.vat_rate = String(patch.vatRate);
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_invoices")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.invoiceById(id);
  }

  // ─── payments ──────────────────────────────────────────────────────────────
  async payments(invoiceId?: string): Promise<PaymentRow[]> {
    let q = currentExecutor()
      .selectFrom("lawfirm_payments")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (invoiceId) q = q.where("invoice_id", "=", invoiceId);
    const rows = await q.orderBy("received_at", "desc").execute();
    return rows.map((r) => this.toPayment(r));
  }

  async createPayment(input: {
    invoiceId: string;
    amount: number;
    currency: Currency;
    method: PaymentMethod;
    receivedAt: Date;
    reference: string | null;
  }): Promise<PaymentRow> {
    const id = lawfirmId("pay");
    await currentExecutor()
      .insertInto("lawfirm_payments")
      .values({
        id,
        organization_id: this.org(),
        invoice_id: input.invoiceId,
        amount: String(input.amount),
        currency: input.currency,
        method: input.method,
        received_at: input.receivedAt,
        reference: input.reference,
      })
      .execute();
    return (await this.payments(input.invoiceId)).find((p) => p.id === id)!;
  }

  // ─── expenses ──────────────────────────────────────────────────────────────
  async expenses(status?: ExpenseStatus): Promise<ExpenseRow[]> {
    let q = currentExecutor()
      .selectFrom("lawfirm_expenses")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (status) q = q.where("status", "=", status);
    const rows = await q.orderBy("incurred_at", "desc").execute();
    return rows.map((r) => this.toExpense(r));
  }

  async expenseById(id: string): Promise<ExpenseRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_expenses")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toExpense(row) : null;
  }

  async createExpense(input: {
    matterId: string | null;
    description: string;
    category: string;
    amount: number;
    currency: Currency;
    incurredAt: Date;
    submittedById: string;
  }): Promise<ExpenseRow> {
    const id = lawfirmId("exp");
    await currentExecutor()
      .insertInto("lawfirm_expenses")
      .values({
        id,
        organization_id: this.org(),
        matter_id: input.matterId,
        description: input.description,
        category: input.category,
        amount: String(input.amount),
        currency: input.currency,
        status: "pending",
        incurred_at: input.incurredAt,
        submitted_by_id: input.submittedById,
      })
      .execute();
    return (await this.expenseById(id))!;
  }

  async setExpenseStatus(id: string, status: ExpenseStatus): Promise<ExpenseRow | null> {
    await currentExecutor()
      .updateTable("lawfirm_expenses")
      .set({ status })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.expenseById(id);
  }

  // ─── denorm lookups ────────────────────────────────────────────────────────
  async clientNames(): Promise<Map<string, string>> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_clients")
      .select(["id", "name"])
      .where("organization_id", "=", this.org())
      .execute();
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async matterInfo(): Promise<Map<string, { title: string; reference: string; leadLawyerId: string }>> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["id", "title", "reference", "lead_lawyer_id"])
      .where("organization_id", "=", this.org())
      .execute();
    return new Map(rows.map((r) => [r.id, { title: r.title, reference: r.reference, leadLawyerId: r.lead_lawyer_id }]));
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

  private async hydrate(
    rows: Array<{
      id: string;
      number: string;
      client_id: string;
      matter_id: string | null;
      status: InvoiceStatus;
      currency: Currency;
      issued_at: Date | string | null;
      due_at: Date | string | null;
      vat_rate: string;
    }>,
  ): Promise<InvoiceRow[]> {
    if (rows.length === 0) return [];
    const lines = await currentExecutor()
      .selectFrom("lawfirm_invoice_lines")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("invoice_id", "in", rows.map((r) => r.id))
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      clientId: r.client_id,
      matterId: r.matter_id,
      status: r.status,
      currency: r.currency,
      issuedAt: r.issued_at ? new Date(r.issued_at) : null,
      dueAt: r.due_at ? new Date(r.due_at) : null,
      vatRate: decimal(r.vat_rate),
      lines: lines
        .filter((l) => l.invoice_id === r.id)
        .map((l) => ({ id: l.id, kind: l.kind, description: l.description, amount: decimal(l.amount) })),
    }));
  }

  private toPayment(r: {
    id: string;
    invoice_id: string;
    amount: string;
    currency: Currency;
    method: PaymentMethod;
    received_at: Date | string;
    reference: string | null;
  }): PaymentRow {
    return {
      id: r.id,
      invoiceId: r.invoice_id,
      amount: decimal(r.amount),
      currency: r.currency,
      method: r.method,
      receivedAt: new Date(r.received_at),
      reference: r.reference,
    };
  }

  private toExpense(r: {
    id: string;
    matter_id: string | null;
    description: string;
    category: string;
    amount: string;
    currency: Currency;
    status: ExpenseStatus;
    incurred_at: Date | string;
    submitted_by_id: string;
  }): ExpenseRow {
    return {
      id: r.id,
      matterId: r.matter_id,
      description: r.description,
      category: r.category,
      amount: decimal(r.amount),
      currency: r.currency,
      status: r.status,
      incurredAt: new Date(r.incurred_at),
      submittedById: r.submitted_by_id,
    };
  }
}
