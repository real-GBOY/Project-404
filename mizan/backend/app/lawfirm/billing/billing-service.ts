import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { moneyList } from "@app/lawfirm/shared/money.js";
import { SettingsService } from "@app/lawfirm/settings/settings-service.js";
import {
  BillingRepository,
  type Currency,
  type ExpenseStatus,
  type InvoiceRow,
  type InvoiceStatus,
  type LineKind,
  type PaymentMethod,
} from "./billing-repository.js";
import { invoiceTotals } from "./invoice.domain.js";

const DAY = 86_400_000;
const CURRENCIES: Currency[] = ["EGP", "AED", "USD", "SAR"];

@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly directory: LawfirmDirectory,
    private readonly activity: ActivityService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  private paidByInvoice(
    payments: Array<{ invoiceId: string; amount: number }>,
  ): Map<string, number> {
    const m = new Map<string, number>();
    for (const p of payments) m.set(p.invoiceId, (m.get(p.invoiceId) ?? 0) + p.amount);
    return m;
  }

  async financeSummary(tab: "invoices" | "payments" | "expenses") {
    return readInTenant(async () => {
      const now = this.clock.now();
      const monthStart = new Date(now);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [invoices, payments] = await Promise.all([this.repo.invoices(), this.repo.payments()]);
      const paid = this.paidByInvoice(payments);
      const totalsFor = (i: InvoiceRow) => invoiceTotals(i, paid.get(i.id) ?? 0);

      if (tab === "payments") {
        const monthPays = payments.filter((p) => p.receivedAt >= monthStart);
        const last30 = payments.filter((p) => p.receivedAt.getTime() >= now.getTime() - 30 * DAY);
        return {
          a: moneyList(monthPays.map((p) => ({ currency: p.currency, amount: p.amount }))),
          b: moneyList(last30.map((p) => ({ currency: p.currency, amount: p.amount }))),
          c: String(monthPays.length),
          d: [],
        };
      }

      if (tab === "expenses") {
        const expenses = await this.repo.expenses();
        const monthExp = expenses.filter((e) => e.incurredAt >= monthStart);
        return {
          a: moneyList(monthExp.map((e) => ({ currency: e.currency, amount: e.amount }))),
          b: moneyList(
            monthExp
              .filter((e) => e.status === "approved")
              .map((e) => ({ currency: e.currency, amount: e.amount })),
          ),
          c: moneyList(
            expenses
              .filter((e) => e.status === "pending")
              .map((e) => ({ currency: e.currency, amount: e.amount })),
          ),
          d: [],
        };
      }

      const billed = moneyList(
        invoices
          .filter((i) => i.issuedAt && i.issuedAt >= yearStart)
          .map((i) => ({ currency: i.currency, amount: totalsFor(i).total })),
      );
      const collected = moneyList(
        payments
          .filter((p) => p.receivedAt >= yearStart)
          .map((p) => ({ currency: p.currency, amount: p.amount })),
      );
      const outstanding = moneyList(
        invoices
          .filter((i) => i.status === "sent" || i.status === "issued")
          .map((i) => ({ currency: i.currency, amount: totalsFor(i).balance })),
      );
      const overdue = invoices.filter(
        (i) => (i.status === "sent" || i.status === "issued") && i.dueAt && i.dueAt < now,
      ).length;
      return { a: billed, b: collected, c: outstanding, d: [], overdue };
    });
  }

  // ─── invoices ──────────────────────────────────────────────────────────────
  async listInvoices(status?: string, clientId?: string) {
    return readInTenant(async () => {
      const rows = await this.repo.invoices({
        status: status && status !== "all" ? (status as InvoiceStatus) : undefined,
        clientId,
      });
      const paid = this.paidByInvoice(await this.repo.payments());
      const clientNames = await this.repo.clientNames();
      const matterInfo = await this.repo.matterInfo();
      const items = rows
        .sort((a, b) => (b.issuedAt?.getTime() ?? 9e15) - (a.issuedAt?.getTime() ?? 9e15))
        .map((i) => {
          const t = invoiceTotals(i, paid.get(i.id) ?? 0);
          const mi = i.matterId ? matterInfo.get(i.matterId) : null;
          return {
            id: i.id,
            number: i.number,
            clientName: clientNames.get(i.clientId) ?? "—",
            matterTitle: mi?.title ?? null,
            matterReference: mi?.reference ?? null,
            status: i.status,
            currency: i.currency,
            total: t.total,
            balance: t.balance,
            issuedAt: i.issuedAt?.toISOString() ?? null,
            dueAt: i.dueAt?.toISOString() ?? null,
          };
        });
      return { items, total: items.length };
    });
  }

  async getInvoice(id: string) {
    const invoice = await readInTenant(() => this.repo.invoiceById(id));
    if (!invoice) throw NotFound("invoice.not_found", "Invoice not found.");
    return readInTenant(() => this.invoiceView(invoice));
  }

  async createInvoice(
    input: {
      clientId: string;
      matterId?: string | null;
      currency?: Currency;
      vatRate?: number;
      lines?: Array<{ kind: LineKind; description: string; amount: number }>;
    },
    actorId: string,
  ) {
    const settings = await this.settings.get();
    const invoice = await this.uow.transaction(async () => {
      if (!(await this.repo.clientExists(input.clientId))) {
        throw ValidationError("invoice.unknown_client", "That client does not exist.");
      }
      const number = await this.repo.nextInvoiceNumber(this.clock.now().getFullYear());
      const created = await this.repo.createInvoice({
        number,
        clientId: input.clientId,
        matterId: input.matterId ?? null,
        currency: input.currency ?? (settings.defaultCurrency as Currency),
        vatRate: input.vatRate ?? settings.vatRate,
        lines: input.lines ?? [],
      });
      await this.audit.record({
        actorId,
        action: "lawfirm.invoice.created",
        resourceType: "lawfirm_invoice",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
    return readInTenant(() => this.invoiceView(invoice));
  }

  async updateInvoice(
    id: string,
    patch: {
      lines?: Array<{ kind: LineKind; description: string; amount: number }>;
      vatRate?: number;
      dueAt?: string | null;
    },
  ) {
    const invoice = await this.uow.transaction(async () => {
      const existing = await this.repo.invoiceById(id);
      if (!existing) throw NotFound("invoice.not_found", "Invoice not found.");
      if (existing.status !== "draft") {
        throw Conflict("invoice.locked", "Only draft invoices can be edited.");
      }
      if (patch.lines) await this.repo.replaceLines(id, patch.lines);
      await this.repo.updateInvoice(id, {
        vatRate: patch.vatRate,
        dueAt: patch.dueAt === undefined ? undefined : patch.dueAt ? new Date(patch.dueAt) : null,
      });
      return (await this.repo.invoiceById(id))!;
    });
    return readInTenant(() => this.invoiceView(invoice));
  }

  async invoiceAction(id: string, action: "issue" | "send" | "void", actorId: string) {
    const invoice = await this.uow.transaction(async () => {
      const existing = await this.repo.invoiceById(id);
      if (!existing) throw NotFound("invoice.not_found", "Invoice not found.");
      if (action === "issue") {
        if (existing.status !== "draft")
          throw Conflict("invoice.bad_state", "Only a draft can be issued.");
        await this.repo.updateInvoice(id, {
          status: "issued",
          issuedAt: this.clock.now(),
          dueAt: new Date(this.clock.now().getTime() + 30 * DAY),
        });
      } else if (action === "send") {
        if (existing.status !== "issued")
          throw Conflict("invoice.bad_state", "Issue the invoice first.");
        await this.repo.updateInvoice(id, { status: "sent" });
      } else {
        if (existing.status === "paid")
          throw Conflict("invoice.bad_state", "A paid invoice can't be voided.");
        await this.repo.updateInvoice(id, { status: "void" });
      }
      await this.events.publish({
        name: `lawfirm.invoice.${action === "void" ? "voided" : action + "d"}`,
        version: 1,
        payload: { invoiceId: id, actorId },
      });
      return (await this.repo.invoiceById(id))!;
    });
    return readInTenant(() => this.invoiceView(invoice));
  }

  // ─── payments ──────────────────────────────────────────────────────────────
  async listPayments() {
    return readInTenant(async () => {
      const payments = await this.repo.payments();
      const invoices = await this.repo.invoices();
      const clientNames = await this.repo.clientNames();
      const items = payments.map((p) => {
        const inv = invoices.find((i) => i.id === p.invoiceId);
        return {
          id: p.id,
          invoiceId: p.invoiceId,
          invoiceNumber: inv?.number ?? "—",
          clientName: inv ? (clientNames.get(inv.clientId) ?? "—") : "—",
          amount: p.amount,
          currency: p.currency,
          method: p.method,
          receivedAt: p.receivedAt.toISOString(),
          reference: p.reference,
        };
      });
      return { items, total: items.length };
    });
  }

  async recordPayment(
    input: {
      invoiceId: string;
      amount: number;
      currency: string;
      method: PaymentMethod;
      receivedAt?: string;
      reference?: string;
    },
    actorId: string,
  ) {
    const payment = await this.uow.transaction(async () => {
      const invoice = await this.repo.invoiceById(input.invoiceId);
      if (!invoice) throw ValidationError("invoice.not_found", "Unknown invoice.");
      if (input.currency !== invoice.currency) {
        throw ValidationError(
          "payment.currency_mismatch",
          `Payment must be in ${invoice.currency}.`,
        );
      }
      const paidSoFar = (await this.repo.payments(invoice.id)).reduce((s, p) => s + p.amount, 0);
      const balance = invoiceTotals(invoice, paidSoFar).balance;
      if (input.amount > balance) {
        throw ValidationError("payment.overpayment", "Amount exceeds the outstanding balance.");
      }
      const row = await this.repo.createPayment({
        invoiceId: input.invoiceId,
        amount: input.amount,
        currency: input.currency as Currency,
        method: input.method,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : this.clock.now(),
        reference: input.reference ?? null,
      });
      const newBalance = invoiceTotals(invoice, paidSoFar + input.amount).balance;
      if (newBalance <= 0) await this.repo.updateInvoice(invoice.id, { status: "paid" });
      await this.activity.record({
        actorId,
        action: "payment.recorded",
        targetType: "payment",
        targetId: row.id,
        targetLabel: `${input.currency} ${input.amount.toLocaleString()} against ${invoice.number}`,
      });
      await this.events.publish({
        name: "lawfirm.payment.recorded",
        version: 1,
        payload: { paymentId: row.id, invoiceId: invoice.id, actorId },
      });
      return row;
    });
    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      receivedAt: payment.receivedAt.toISOString(),
      reference: payment.reference,
    };
  }

  // ─── expenses ──────────────────────────────────────────────────────────────
  async listExpenses(status?: string) {
    return readInTenant(async () => {
      const rows = await this.repo.expenses(
        status && status !== "all" ? (status as ExpenseStatus) : undefined,
      );
      const matterInfo = await this.repo.matterInfo();
      const names = await this.directory.userNames(rows.map((e) => e.submittedById));
      const items = rows.map((e) => {
        const mi = e.matterId ? matterInfo.get(e.matterId) : null;
        return {
          id: e.id,
          reference: e.id.toUpperCase().replace("EXP_", "EXP-"),
          description: e.description,
          category: e.category,
          matterTitle: mi?.title ?? null,
          matterReference: mi?.reference ?? null,
          amount: e.amount,
          currency: e.currency,
          status: e.status,
          incurredAt: e.incurredAt.toISOString(),
          submittedBy: names.get(e.submittedById) ?? null,
        };
      });
      return { items, total: items.length };
    });
  }

  async recordExpense(
    input: {
      description: string;
      category?: string;
      amount: number;
      currency?: string;
      matterId?: string | null;
      incurredAt?: string;
    },
    actorId: string,
  ) {
    const expense = await this.uow.transaction(() =>
      this.repo.createExpense({
        matterId: input.matterId ?? null,
        description: input.description,
        category: input.category ?? "Disbursement",
        amount: input.amount,
        currency: (input.currency as Currency) ?? "EGP",
        incurredAt: input.incurredAt ? new Date(input.incurredAt) : this.clock.now(),
        submittedById: actorId,
      }),
    );
    return this.expenseRow(expense);
  }

  async approveExpense(id: string, actorId: string) {
    const expense = await this.uow.transaction(async () => {
      const existing = await this.repo.expenseById(id);
      if (!existing) throw NotFound("expense.not_found", "Expense not found.");
      const updated = (await this.repo.setExpenseStatus(id, "approved"))!;
      await this.events.publish({
        name: "lawfirm.expense.approved",
        version: 1,
        payload: { expenseId: id, actorId },
      });
      return updated;
    });
    return this.expenseRow(expense);
  }

  // ─── shaping ───────────────────────────────────────────────────────────────
  private async invoiceView(i: InvoiceRow) {
    const payments = await this.repo.payments(i.id);
    const totals = invoiceTotals(
      i,
      payments.reduce((s, p) => s + p.amount, 0),
    );
    const clientNames = await this.repo.clientNames();
    const matterInfo = i.matterId ? (await this.repo.matterInfo()).get(i.matterId) : null;
    return {
      id: i.id,
      number: i.number,
      clientId: i.clientId,
      clientName: clientNames.get(i.clientId) ?? "—",
      matterId: i.matterId,
      matterTitle: matterInfo?.title ?? null,
      matterReference: matterInfo?.reference ?? null,
      billingPartner: matterInfo
        ? ((await this.directory.userName(matterInfo.leadLawyerId)) ?? "—")
        : "—",
      terms: "30 days from issue · bank transfer to CIB 0114-882-9",
      status: i.status,
      currency: i.currency,
      issuedAt: i.issuedAt?.toISOString() ?? null,
      dueAt: i.dueAt?.toISOString() ?? null,
      vatRate: i.vatRate,
      lines: i.lines,
      totals,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        receivedAt: p.receivedAt.toISOString(),
        reference: p.reference,
      })),
    };
  }

  private expenseRow(e: {
    id: string;
    matterId: string | null;
    description: string;
    category: string;
    amount: number;
    currency: Currency;
    status: ExpenseStatus;
    incurredAt: Date;
    submittedById: string;
  }) {
    return {
      id: e.id,
      matterId: e.matterId,
      description: e.description,
      category: e.category,
      amount: e.amount,
      currency: e.currency,
      status: e.status,
      incurredAt: e.incurredAt.toISOString(),
    };
  }

  /** exported for the currency union */
  static readonly CURRENCIES = CURRENCIES;
}
