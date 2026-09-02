import { http, HttpResponse } from "msw";
import {
  CURRENT_USER_ID,
  clientName,
  db,
  invoiceTotals,
  matterRef,
  matterTitle,
  nextId,
  userName,
  type ExpenseRow,
  type InvoiceRow,
  type PaymentRow,
} from "../fixtures/db";

const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

function invoiceView(i: InvoiceRow) {
  const totals = invoiceTotals(i);
  const m = i.matterId ? db.matters.find((x) => x.id === i.matterId) : null;
  return {
    id: i.id,
    number: i.number,
    clientId: i.clientId,
    clientName: clientName(i.clientId),
    matterId: i.matterId,
    matterTitle: matterTitle(i.matterId),
    matterReference: matterRef(i.matterId),
    billingPartner: m ? (userName(m.leadLawyerId) ?? "—") : "—",
    terms: `30 days from issue · bank transfer to CIB 0114-882-9`,
    status: i.status,
    currency: i.currency,
    issuedAt: i.issuedAt,
    dueAt: i.dueAt,
    vatRate: i.vatRate,
    lines: i.lines,
    totals,
    payments: db.payments
      .filter((p) => p.invoiceId === i.id)
      .map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        receivedAt: p.receivedAt,
        reference: p.reference,
      })),
  };
}

const findInvoice = (id: string) => db.invoices.find((i) => i.id === id);

function moneyList(entries: { currency: string; amount: number }[]) {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  return [...map.entries()]
    .filter(([, a]) => a !== 0)
    .map(([currency, amount]) => ({ currency, amount: String(Math.round(amount)) }));
}

export const billingHandlers = [
  http.get("/api/finance/summary", ({ request }) => {
    const tab = new URL(request.url).searchParams.get("tab") ?? "invoices";
    const now = Date.now();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    if (tab === "payments") {
      const monthPays = db.payments.filter(
        (p) => new Date(p.receivedAt).getTime() >= monthStart.getTime(),
      );
      return HttpResponse.json({
        a: moneyList(monthPays.map((p) => ({ currency: p.currency, amount: p.amount }))),
        b: moneyList(
          db.payments
            .filter((p) => new Date(p.receivedAt).getTime() >= now - 5 * 86_400_000)
            .map((p) => ({ currency: p.currency, amount: Math.round(p.amount * 0.15) })),
        ),
        c: "34",
        d: moneyList([{ currency: "EGP", amount: 640_000 }]),
      });
    }
    if (tab === "expenses") {
      const monthExp = db.expenses.filter(
        (e) => new Date(e.incurredAt).getTime() >= monthStart.getTime(),
      );
      return HttpResponse.json({
        a: moneyList(monthExp.map((e) => ({ currency: e.currency, amount: e.amount }))),
        b: moneyList(
          monthExp
            .filter((e) => e.status === "approved")
            .map((e) => ({ currency: e.currency, amount: e.amount })),
        ),
        c: moneyList(
          db.expenses
            .filter((e) => e.status === "pending")
            .map((e) => ({ currency: e.currency, amount: e.amount })),
        ),
        d: moneyList([{ currency: "EGP", amount: 1_120_000 }]),
      });
    }
    // invoices
    const billed = moneyList(
      db.invoices
        .filter((i) => i.issuedAt && new Date(i.issuedAt).getTime() >= yearStart)
        .map((i) => ({ currency: i.currency, amount: invoiceTotals(i).total })),
    );
    const collected = moneyList(
      db.payments
        .filter((p) => new Date(p.receivedAt).getTime() >= yearStart)
        .map((p) => ({ currency: p.currency, amount: p.amount })),
    );
    const outstanding = moneyList(
      db.invoices
        .filter((i) => i.status === "sent" || i.status === "issued")
        .map((i) => ({ currency: i.currency, amount: invoiceTotals(i).balance })),
    );
    const openTasks = db.tasks.filter((k) => k.status !== "done").length;
    return HttpResponse.json({
      a: billed,
      b: collected,
      c: outstanding,
      d: moneyList([{ currency: "EGP", amount: openTasks * 74_000 }]),
      overdue: db.invoices.filter(
        (i) => (i.status === "sent" || i.status === "issued") && i.dueAt && new Date(i.dueAt).getTime() < now,
      ).length,
    });
  }),

  // ─── invoices ──────────────────────────────────────────────────────────────
  http.get("/api/invoices", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const clientId = url.searchParams.get("clientId");
    let rows = [...db.invoices];
    if (status && status !== "all") rows = rows.filter((i) => i.status === status);
    if (clientId) rows = rows.filter((i) => i.clientId === clientId);
    rows.sort((a, b) => (b.issuedAt ?? "9999").localeCompare(a.issuedAt ?? "9999"));
    return HttpResponse.json({
      items: rows.map((i) => {
        const totals = invoiceTotals(i);
        return {
          id: i.id,
          number: i.number,
          clientName: clientName(i.clientId),
          matterTitle: matterTitle(i.matterId),
          matterReference: matterRef(i.matterId),
          status: i.status,
          currency: i.currency,
          total: totals.total,
          balance: totals.balance,
          issuedAt: i.issuedAt,
          dueAt: i.dueAt,
        };
      }),
      total: rows.length,
    });
  }),

  http.post("/api/invoices", async ({ request }) => {
    const b = (await request.json()) as Partial<InvoiceRow> & { lines?: InvoiceRow["lines"] };
    const year = new Date().getFullYear();
    const count = db.invoices.length + 129;
    const row: InvoiceRow = {
      id: nextId("inv"),
      number: `INV-${year}-${String(count).padStart(4, "0")}`,
      clientId: b.clientId ?? db.clients[0].id,
      matterId: b.matterId ?? null,
      status: "draft",
      currency: (b.currency as InvoiceRow["currency"]) ?? "EGP",
      issuedAt: null,
      dueAt: null,
      vatRate: b.vatRate ?? db.settings.vatRate,
      lines: (b.lines ?? []).map((l) => ({ ...l, id: nextId("il") })),
    };
    db.invoices.unshift(row);
    return HttpResponse.json(invoiceView(row), { status: 201 });
  }),

  http.get("/api/invoices/:id", ({ params }) => {
    const i = findInvoice(params.id as string);
    return i ? HttpResponse.json(invoiceView(i)) : err(404, "invoice.not_found", "Invoice not found.");
  }),

  http.patch("/api/invoices/:id", async ({ params, request }) => {
    const i = findInvoice(params.id as string);
    if (!i) return err(404, "invoice.not_found", "Invoice not found.");
    if (i.status !== "draft") return err(409, "invoice.locked", "Only draft invoices can be edited.");
    const b = (await request.json()) as Partial<InvoiceRow>;
    Object.assign(i, {
      lines: b.lines ? b.lines.map((l) => ({ ...l, id: l.id ?? nextId("il") })) : i.lines,
      vatRate: b.vatRate ?? i.vatRate,
      dueAt: b.dueAt ?? i.dueAt,
    });
    return HttpResponse.json(invoiceView(i));
  }),

  ...(["issue", "send", "void"] as const).map((action) =>
    http.post(`/api/invoices/:id/${action}`, ({ params }) => {
      const i = findInvoice(params.id as string);
      if (!i) return err(404, "invoice.not_found", "Invoice not found.");
      if (action === "issue") {
        if (i.status !== "draft") return err(409, "invoice.bad_state", "Only a draft can be issued.");
        i.status = "issued";
        i.issuedAt = new Date().toISOString();
        i.dueAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
      } else if (action === "send") {
        if (i.status !== "issued") return err(409, "invoice.bad_state", "Issue the invoice first.");
        i.status = "sent";
      } else {
        if (i.status === "paid") return err(409, "invoice.bad_state", "A paid invoice can't be voided.");
        i.status = "void";
      }
      return HttpResponse.json(invoiceView(i));
    }),
  ),

  // ─── payments ──────────────────────────────────────────────────────────────
  http.get("/api/payments", () =>
    HttpResponse.json({
      items: [...db.payments]
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .map((p) => {
          const inv = db.invoices.find((i) => i.id === p.invoiceId);
          return {
            id: p.id,
            invoiceId: p.invoiceId,
            invoiceNumber: inv?.number ?? "—",
            clientName: inv ? clientName(inv.clientId) : "—",
            amount: p.amount,
            currency: p.currency,
            method: p.method,
            receivedAt: p.receivedAt,
            reference: p.reference,
          };
        }),
      total: db.payments.length,
    }),
  ),

  http.post("/api/payments", async ({ request }) => {
    const b = (await request.json()) as {
      invoiceId: string;
      amount: number;
      currency: string;
      method: PaymentRow["method"];
      receivedAt?: string;
      reference?: string;
    };
    const inv = findInvoice(b.invoiceId);
    if (!inv) return err(400, "invoice.not_found", "Unknown invoice.");
    if (b.currency !== inv.currency)
      return err(422, "payment.currency_mismatch", `Payment must be in ${inv.currency}.`);
    const balance = invoiceTotals(inv).balance;
    if (b.amount > balance)
      return err(422, "payment.overpayment", "Amount exceeds the outstanding balance.");
    const row: PaymentRow = {
      id: nextId("pay"),
      invoiceId: b.invoiceId,
      amount: b.amount,
      currency: b.currency as PaymentRow["currency"],
      method: b.method,
      receivedAt: b.receivedAt ?? new Date().toISOString(),
      reference: b.reference ?? null,
    };
    db.payments.push(row);
    if (invoiceTotals(inv).balance <= 0) inv.status = "paid";
    db.activity.unshift({
      id: nextId("act"),
      actorId: CURRENT_USER_ID,
      action: "payment.recorded",
      targetType: "payment",
      targetId: row.id,
      targetLabel: `${b.currency} ${b.amount.toLocaleString()} against ${inv.number}`,
      at: new Date().toISOString(),
    });
    return HttpResponse.json(row, { status: 201 });
  }),

  // ─── expenses ──────────────────────────────────────────────────────────────
  http.get("/api/expenses", ({ request }) => {
    const status = new URL(request.url).searchParams.get("status");
    let rows = [...db.expenses];
    if (status && status !== "all") rows = rows.filter((e) => e.status === status);
    rows.sort((a, b) => b.incurredAt.localeCompare(a.incurredAt));
    return HttpResponse.json({
      items: rows.map((e) => ({
        id: e.id,
        reference: e.id.toUpperCase().replace("EXP_", "EXP-"),
        description: e.description,
        category: e.category,
        matterTitle: matterTitle(e.matterId),
        matterReference: matterRef(e.matterId),
        amount: e.amount,
        currency: e.currency,
        status: e.status,
        incurredAt: e.incurredAt,
        submittedBy: userName(e.submittedById),
      })),
      total: rows.length,
    });
  }),

  http.post("/api/expenses", async ({ request }) => {
    const b = (await request.json()) as Partial<ExpenseRow>;
    const row: ExpenseRow = {
      id: nextId("exp"),
      matterId: b.matterId ?? null,
      description: b.description ?? "Expense",
      category: b.category ?? "Disbursement",
      amount: b.amount ?? 0,
      currency: (b.currency as ExpenseRow["currency"]) ?? "EGP",
      status: "pending",
      incurredAt: b.incurredAt ?? new Date().toISOString(),
      submittedById: CURRENT_USER_ID,
    };
    db.expenses.unshift(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.post("/api/expenses/:id/approve", ({ params }) => {
    const e = db.expenses.find((x) => x.id === params.id);
    if (!e) return err(404, "expense.not_found", "Expense not found.");
    e.status = "approved";
    return HttpResponse.json(e);
  }),
];
