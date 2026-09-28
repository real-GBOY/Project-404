import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { FolioCard } from "@/features/billing/folio-card";
import { InvoicePage } from "@/features/billing/invoice-page";
import { CheckOutDialog } from "@/features/front-desk/check-out-dialog";
import { ReservationsPage } from "@/features/reservations/reservations-page";
import { PaymentsPage } from "./payments-page";

const RESERVATION = {
  id: "rsv_1",
  code: "BK-1042",
  status: "cancelled",
  source: "website",
  guestId: "gst_1",
  guestName: "Ahmed Mohamed",
  guestPhone: null,
  guestVip: false,
  roomTypeId: "rmt_1",
  roomTypeName: "Grand Deluxe Room",
  roomId: null,
  roomNumber: null,
  arrival: "2026-10-05",
  departure: "2026-10-07",
  nights: 2,
  adults: 2,
  children: 0,
  nightlyRates: [],
  roomTotal: 10800,
  discountCode: null,
  discountAmount: 0,
  total: 10800,
  notes: null,
  cancellationReason: "Plans changed",
  createdAt: "2026-09-27T08:00:00Z",
};

const payment = (id: string, amount: number, refundable: number) => ({
  id,
  method: "card",
  amount,
  status: "completed",
  failureReason: null,
  refundable,
  receivedByName: "Rania Kamal",
  businessDate: "2026-09-26",
  createdAt: "2026-09-26T08:00:00Z",
});

const creditFolio = {
  reservationId: "rsv_1",
  invoiceId: null,
  invoices: [],
  credit: 2000,
  charges: [],
  payments: [payment("pay_1", 2000, 2000)],
  refunds: [],
  totals: {
    charges: 0,
    tax: 0,
    total: 0,
    paid: 2000,
    refunded: 0,
    balance: -2000,
    paymentStatus: "paid",
    posted: false,
  },
};

describe("Refunds", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers a refund only to finance staff, capped at the credit, under one idempotency key", async () => {
    const posted: Array<{ body: unknown; key: string | null }> = [];
    stubApi({
      permissions: ["read:folio", "create:refund"],
      routes: [
        (url, init) => {
          if (url.pathname.endsWith("/refunds") && init?.method === "POST") {
            posted.push({
              body: JSON.parse(String(init.body)),
              key: new Headers(init.headers).get("idempotency-key"),
            });
            return json(201, { items: [{ id: "rfd_1", status: "completed", amount: 2000 }] });
          }
          return url.pathname.endsWith("/folio") ? json(200, creditFolio) : undefined;
        },
      ],
    });
    renderApp(<FolioCard reservation={RESERVATION as never} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Refund 2,000 EGP" }));
    const dialog = screen.getByRole("dialog");
    const amount = within(dialog).getByLabelText("Amount (EGP)");
    await user.clear(amount);
    await user.type(amount, "2500");
    await user.type(within(dialog).getByLabelText("Reason"), "Booking cancelled");
    await user.click(within(dialog).getByRole("button", { name: "Refund" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "between 0.01 and 2,000 EGP",
    );
    expect(posted).toHaveLength(0);

    await user.clear(amount);
    await user.type(amount, "2000");
    await user.click(within(dialog).getByRole("button", { name: "Refund" }));
    expect(await screen.findByText("2,000 EGP refunded")).toBeInTheDocument();
    expect(posted[0]!.body).toEqual({ amount: 2000, reason: "Booking cancelled", paymentId: null });
    expect(posted[0]!.key).toMatch(/^pay_/);
  });

  it("hides the refund action from staff without create:refund", async () => {
    stubApi({
      permissions: ["read:folio"],
      routes: [(url) => (url.pathname.endsWith("/folio") ? json(200, creditFolio) : undefined)],
    });
    renderApp(<FolioCard reservation={RESERVATION as never} />);
    expect(await screen.findByText("Overpaid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refund/ })).not.toBeInTheDocument();
  });

  it("checks an overpaid guest out with the refund in the same step", async () => {
    let body: unknown;
    stubApi({
      permissions: ["check_out:reservation", "read:folio", "create:refund"],
      routes: [
        (url, init) => {
          if (url.pathname.endsWith("/check-out")) {
            body = JSON.parse(String(init?.body));
            return json(200, {
              reservation: { ...RESERVATION, status: "checked_out" },
              invoiceId: "inv_1",
              housekeepingTaskId: "hkt_1",
              refunded: true,
            });
          }
          return url.pathname.endsWith("/folio") ? json(200, creditFolio) : undefined;
        },
      ],
    });
    renderApp(
      <CheckOutDialog
        reservation={{ ...RESERVATION, status: "checked_in", roomNumber: "305" } as never}
        onClose={() => {}}
      />,
    );
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Refund 2,000 EGP & check out" }));
    expect(await screen.findByRole("link", { name: "View invoice" })).toBeInTheDocument();
    expect(body).toEqual({ payment: null, refund: true });
  });
});

describe("Finance screens", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the design's summary cards and a ledger with refunds as money going out", async () => {
    stubApi({
      permissions: ["read:payment", "read:invoice"],
      routes: [
        (url) =>
          url.pathname.endsWith("/finance/summary")
            ? json(200, {
                date: "2026-09-27",
                today: { collected: 6000, refunded: 0 },
                month: { collected: 90000, refunded: 3000, net: 87000 },
                pendingCount: 0,
                outstanding: 18500,
                credits: 1500,
                openFolios: 5,
              })
            : undefined,
        (url) =>
          url.pathname.endsWith("/hotel/payments")
            ? json(200, {
                items: [
                  {
                    id: "rfd_1",
                    kind: "refund",
                    reservationId: "rsv_1",
                    reservationCode: "BK-1042",
                    guestName: "Ahmed Mohamed",
                    method: "card",
                    amount: 2000,
                    status: "completed",
                    actorName: "Dina Samir",
                    businessDate: "2026-09-27",
                    createdAt: "2026-09-27T08:00:00Z",
                  },
                  {
                    id: "pay_1",
                    kind: "payment",
                    reservationId: "rsv_1",
                    reservationCode: "BK-1042",
                    guestName: "Ahmed Mohamed",
                    method: "card",
                    amount: 2000,
                    status: "completed",
                    actorName: "Rania Kamal",
                    businessDate: "2026-09-26",
                    createdAt: "2026-09-26T08:00:00Z",
                  },
                ],
              })
            : undefined,
      ],
    });
    renderApp(<PaymentsPage />, "/payments");
    expect(await screen.findByLabelText("Today's Payments")).toHaveTextContent("6,000 EGP");
    expect(screen.getByLabelText("Outstanding")).toHaveTextContent("18,500 EGP");
    expect(screen.getByLabelText("Refunds this month")).toHaveTextContent(
      "1,500 EGP still owed back",
    );
    expect(await screen.findByText("−2,000 EGP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invoices" })).toBeInTheDocument();
  });

  it("shows each booking's payment state in the reservations list", async () => {
    const row = (id: string, code: string) => ({ ...RESERVATION, id, code, status: "confirmed" });
    stubApi({
      permissions: ["read:reservation", "read:folio"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/reservations")
            ? json(200, { items: [row("rsv_a", "BK-1"), row("rsv_b", "BK-2")], total: 2 })
            : undefined,
        (url) => {
          if (!url.pathname.endsWith("/hotel/folios")) return undefined;
          expect(url.searchParams.get("ids")).toBe("rsv_a,rsv_b");
          const t = { charges: 0, tax: 0, refunded: 0, posted: false };
          return json(200, {
            items: [
              {
                reservationId: "rsv_a",
                ...t,
                total: 12312,
                paid: 12312,
                balance: 0,
                paymentStatus: "paid",
              },
              {
                reservationId: "rsv_b",
                ...t,
                total: 12312,
                paid: 3000,
                balance: 9312,
                paymentStatus: "partial",
              },
            ],
          });
        },
      ],
    });
    renderApp(<ReservationsPage />);
    expect(await screen.findByText("Paid in full")).toBeInTheDocument();
    expect(screen.getByText("3,000 EGP / 12,312 EGP")).toBeInTheDocument();
  });

  it("lets only finance staff void an invoice, and shows why a void invoice was voided", async () => {
    const invoice = (status: "issued" | "void") => ({
      id: "inv_1",
      number: "INV-1001",
      status,
      subtotal: 10000,
      tax: 1400,
      total: 11400,
      taxRate: 0.14,
      billToName: "Ahmed Mohamed",
      issuedAt: "2026-09-27T08:00:00Z",
      voidedAt: status === "void" ? "2026-09-27T10:00:00Z" : null,
      voidReason: status === "void" ? "Minibar charged in error" : null,
      items: [],
      reservation: {
        id: "rsv_1",
        code: "BK-1042",
        roomNumber: "305",
        roomTypeName: "Grand Deluxe Room",
        arrival: "2026-09-25",
        departure: "2026-09-27",
      },
    });
    const page = (
      <Routes>
        <Route path="/invoices/:invoiceId" element={<InvoicePage />} />
      </Routes>
    );
    const routes = (status: "issued" | "void") => [
      (url: URL) =>
        url.pathname.endsWith("/invoices/inv_1") ? json(200, invoice(status)) : undefined,
      (url: URL) =>
        url.pathname.endsWith("/hotel/settings")
          ? json(200, { hotelName: "Hotel Transylvania" })
          : undefined,
    ];

    stubApi({ permissions: ["read:invoice"], routes: routes("issued") });
    const reader = renderApp(page, "/invoices/inv_1");
    await screen.findByText("INV-1001");
    expect(screen.queryByRole("button", { name: "Void invoice" })).not.toBeInTheDocument();
    reader.unmount();
    vi.unstubAllGlobals();

    stubApi({ permissions: ["read:invoice", "void:invoice"], routes: routes("issued") });
    const accountant = renderApp(page, "/invoices/inv_1");
    expect(await screen.findByRole("button", { name: "Void invoice" })).toBeInTheDocument();
    accountant.unmount();
    vi.unstubAllGlobals();

    stubApi({ permissions: ["read:invoice", "void:invoice"], routes: routes("void") });
    renderApp(page, "/invoices/inv_1");
    expect(await screen.findByText(/Void since .* — Minibar charged in error/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Void invoice" })).not.toBeInTheDocument();
  });
});
