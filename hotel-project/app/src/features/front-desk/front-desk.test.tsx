import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { FrontDeskPage } from "./front-desk-page";
import { FolioCard } from "@/features/billing/folio-card";

const base = {
  source: "website",
  guestPhone: null,
  guestVip: false,
  roomTypeId: "rmt_1",
  roomTypeName: "Grand Deluxe Room",
  roomId: "rom_305",
  adults: 2,
  children: 0,
  nightlyRates: [],
  roomTotal: 10800,
  discountCode: null,
  discountAmount: 0,
  total: 10800,
  notes: null,
  cancellationReason: null,
  createdAt: "2026-09-27T08:00:00Z",
  nights: 2,
};

const ARRIVAL = {
  ...base,
  id: "rsv_a",
  code: "BK-1042",
  status: "confirmed",
  guestId: "gst_1",
  guestName: "Ahmed Mohamed",
  roomNumber: "305",
  arrival: "2026-09-27",
  departure: "2026-09-29",
  folio: { total: 12312, paid: 0, balance: 12312, paymentStatus: "pending" },
  room: { housekeepingStatus: "dirty", serviceStatus: "in_service", ready: false },
};

const DEPARTURE = {
  ...base,
  id: "rsv_d",
  code: "BK-1030",
  status: "checked_in",
  guestId: "gst_2",
  guestName: "Sara El-Sayed",
  roomNumber: "201",
  arrival: "2026-09-25",
  departure: "2026-09-27",
  folio: { total: 9120, paid: 4000, balance: 5120, paymentStatus: "partial" },
  room: { housekeepingStatus: "clean", serviceStatus: "in_service", ready: true },
};

const deskRoute = (url: URL) =>
  url.pathname.endsWith("/hotel/front-desk/today")
    ? json(200, {
        date: "2026-09-27",
        arrivals: [ARRIVAL],
        departures: [DEPARTURE],
        inHouse: [DEPARTURE],
      })
    : undefined;

const folio = (balance: number) => ({
  reservationId: "rsv_d",
  invoiceId: null,
  invoices: [],
  credit: Math.max(-balance, 0),
  charges: [],
  payments: [],
  refunds: [],
  totals: {
    charges: 8000,
    tax: 1120,
    total: 9120,
    paid: 9120 - balance,
    refunded: 0,
    balance,
    paymentStatus: balance > 0 ? "partial" : "paid",
    posted: true,
  },
});

describe("Front desk", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists arrivals and departures with payment state and room readiness", async () => {
    stubApi({
      permissions: ["read:reservation", "check_in:reservation", "check_out:reservation"],
      routes: [deskRoute],
    });
    renderApp(<FrontDeskPage />);
    expect(await screen.findByText("Today's Arrivals · 1")).toBeInTheDocument();
    expect(screen.getByText("Room 305 not ready (dirty)")).toBeInTheDocument();
    expect(screen.getByText("Balance due")).toBeInTheDocument();
    expect(screen.getAllByText("Due 5,120 EGP").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Check In" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check Out" })).toBeInTheDocument();
  });

  it("hides desk actions from someone who may only read", async () => {
    stubApi({ permissions: ["read:reservation"], routes: [deskRoute] });
    renderApp(<FrontDeskPage />);
    await screen.findByText("Ahmed Mohamed");
    expect(screen.queryByRole("button", { name: "Check In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check Out" })).not.toBeInTheDocument();
  });

  it("settles exactly the server's balance at check-out, under one idempotency key", async () => {
    const posted: Array<{ body: unknown; key: string | null }> = [];
    stubApi({
      permissions: ["read:reservation", "check_out:reservation", "read:folio", "read:invoice"],
      routes: [
        deskRoute,
        (url) =>
          url.pathname.endsWith("/hotel/reservations/rsv_d/folio")
            ? json(200, folio(5120))
            : undefined,
        (url, init) => {
          if (url.pathname.endsWith("/hotel/reservations/rsv_d/check-out")) {
            posted.push({
              body: JSON.parse(String(init?.body)),
              key: new Headers(init?.headers).get("idempotency-key"),
            });
            return json(200, {
              reservation: { ...DEPARTURE, status: "checked_out" },
              invoiceId: "inv_1",
              housekeepingTaskId: "hkt_1",
            });
          }
          return undefined;
        },
      ],
    });
    renderApp(<FrontDeskPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Check Out" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Settle with"), "cash");
    await user.click(
      await within(dialog).findByRole("button", { name: "Take 5,120 EGP & check out" }),
    );
    expect(await within(dialog).findByRole("link", { name: "View invoice" })).toHaveAttribute(
      "href",
      "/invoices/inv_1",
    );
    expect(posted).toHaveLength(1);
    // A receptionist can't refund, so check-out doesn't ask the server to.
    expect(posted[0]!.body).toEqual({ payment: { method: "cash", amount: 5120 } });
    expect(posted[0]!.key).toMatch(/^pay_/);
  });
});

describe("Payment summary", () => {
  afterEach(() => vi.unstubAllGlobals());

  const reservation = { ...DEPARTURE } as never;

  it("offers Collect Payment and Add charge only with the right permissions", async () => {
    stubApi({
      permissions: ["read:folio"],
      routes: [(url) => (url.pathname.endsWith("/folio") ? json(200, folio(5120)) : undefined)],
    });
    renderApp(<FolioCard reservation={reservation} />);
    expect(await screen.findByText("Payment Summary")).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collect Payment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add charge" })).not.toBeInTheDocument();
  });

  it("won't send a payment above the balance", async () => {
    const fetchMock = stubApi({
      permissions: ["read:folio", "create:payment", "post:charge"],
      routes: [(url) => (url.pathname.endsWith("/folio") ? json(200, folio(5120)) : undefined)],
    });
    renderApp(<FolioCard reservation={reservation} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Collect Payment" }));
    const amount = screen.getByLabelText("Amount (EGP)");
    await user.clear(amount);
    await user.type(amount, "6000");
    await user.click(screen.getByRole("button", { name: "Take payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("between 0.01 and 5,120 EGP");
    expect(
      fetchMock.mock.calls.some(
        ([u, init]) => String(u).includes("/payments") && init?.method === "POST",
      ),
    ).toBe(false);
    expect(screen.getByRole("button", { name: "Add charge" })).toBeInTheDocument();
  });
});
