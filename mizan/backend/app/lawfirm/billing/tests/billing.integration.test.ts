import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { fixedClock } from "@core/kernel/clock.js";
import {
  asUser,
  createMizanTestApp,
  get,
  hasTestDb,
  seedFirm,
  type SeededFirm,
} from "@app/lawfirm/tests/helpers.js";
import { ClientsService } from "@app/lawfirm/clients/clients-service.js";
import { BillingService } from "@app/lawfirm/billing/billing-service.js";
import { invoiceTotals } from "@app/lawfirm/billing/invoice.domain.js";

const suite = hasTestDb ? describe : describe.skip;

describe("invoiceTotals (domain)", () => {
  it("total = fees + disbursements + round(fees*vat); balance = total - paid", () => {
    const t = invoiceTotals(
      {
        vatRate: 0.14,
        lines: [
          { id: "1", kind: "fee", description: "f", amount: 220_000 },
          { id: "2", kind: "disbursement", description: "d", amount: 4_500 },
        ],
      },
      100_000,
    );
    expect(t).toEqual({
      fees: 220_000,
      disbursements: 4_500,
      vat: 30_800,
      total: 255_300,
      paid: 100_000,
      balance: 155_300,
    });
  });
});

suite("lawfirm/billing", () => {
  let app: TestingModule;
  let firm: SeededFirm;
  let clientId: string;
  const clock = fixedClock("2026-06-01T09:00:00.000Z");
  const billing = () => get<BillingService>(app, BillingService);

  beforeAll(async () => {
    app = await createMizanTestApp({ clock });
    firm = await seedFirm(app);
    const c = await asUser(firm.adminId, firm.orgId, () =>
      get<ClientsService>(app, ClientsService).create(
        {
          name: "Al-Nour",
          type: "company",
          email: null,
          phone: null,
          taxId: null,
          address: null,
          notes: null,
        },
        firm.adminId,
      ),
    );
    clientId = c.id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  async function draftInvoice(currency = "EGP") {
    return asUser(firm.adminId, firm.orgId, () =>
      billing().createInvoice(
        {
          clientId,
          currency: currency as "EGP",
          vatRate: 0.14,
          lines: [{ kind: "fee", description: "Fees", amount: 100_000 }],
        },
        firm.adminId,
      ),
    );
  }

  it("invoice lifecycle draft → issued → sent, with a generated number", async () => {
    const inv = await draftInvoice();
    expect(inv.number).toMatch(/^INV-2026-\d{4}$/);
    expect(inv.totals.total).toBe(114_000);

    const issued = await asUser(firm.adminId, firm.orgId, () =>
      billing().invoiceAction(inv.id, "issue", firm.adminId),
    );
    expect(issued.status).toBe("issued");
    expect(issued.issuedAt).not.toBeNull();
    const sent = await asUser(firm.adminId, firm.orgId, () =>
      billing().invoiceAction(inv.id, "send", firm.adminId),
    );
    expect(sent.status).toBe("sent");
  });

  it("a non-draft invoice cannot be edited (409 invoice.locked)", async () => {
    const inv = await draftInvoice();
    await asUser(firm.adminId, firm.orgId, () =>
      billing().invoiceAction(inv.id, "issue", firm.adminId),
    );
    await expect(
      asUser(firm.adminId, firm.orgId, () => billing().updateInvoice(inv.id, { vatRate: 0.1 })),
    ).rejects.toMatchObject({ code: "invoice.locked" });
  });

  it("payment currency must match the invoice", async () => {
    const inv = await draftInvoice("EGP");
    await asUser(firm.adminId, firm.orgId, () =>
      billing().invoiceAction(inv.id, "issue", firm.adminId),
    );
    await expect(
      asUser(firm.adminId, firm.orgId, () =>
        billing().recordPayment(
          { invoiceId: inv.id, amount: 1000, currency: "AED", method: "cash" },
          firm.adminId,
        ),
      ),
    ).rejects.toMatchObject({ code: "payment.currency_mismatch" });
  });

  it("payment cannot exceed the outstanding balance; full payment flips the invoice to paid", async () => {
    const inv = await draftInvoice("EGP");
    await asUser(firm.adminId, firm.orgId, () =>
      billing().invoiceAction(inv.id, "issue", firm.adminId),
    );
    await expect(
      asUser(firm.adminId, firm.orgId, () =>
        billing().recordPayment(
          { invoiceId: inv.id, amount: 999_999, currency: "EGP", method: "bank_transfer" },
          firm.adminId,
        ),
      ),
    ).rejects.toMatchObject({ code: "payment.overpayment" });

    await asUser(firm.adminId, firm.orgId, () =>
      billing().recordPayment(
        { invoiceId: inv.id, amount: 114_000, currency: "EGP", method: "bank_transfer" },
        firm.adminId,
      ),
    );
    const paid = await asUser(firm.adminId, firm.orgId, () => billing().getInvoice(inv.id));
    expect(paid.status).toBe("paid");
    expect(paid.totals.balance).toBe(0);
  });

  it("expenses: record → approve", async () => {
    const e = await asUser(firm.adminId, firm.orgId, () =>
      billing().recordExpense(
        { description: "Court fees", amount: 3200, currency: "EGP" },
        firm.adminId,
      ),
    );
    expect(e.status).toBe("pending");
    const approved = await asUser(firm.adminId, firm.orgId, () =>
      billing().approveExpense(e.id, firm.adminId),
    );
    expect(approved.status).toBe("approved");
  });

  it("finance summary d slot is empty and invoices tab carries an overdue count", async () => {
    const summary = await asUser(firm.adminId, firm.orgId, () =>
      billing().financeSummary("invoices"),
    );
    expect(summary.d).toEqual([]);
    expect(typeof summary.overdue).toBe("number");
  });
});
