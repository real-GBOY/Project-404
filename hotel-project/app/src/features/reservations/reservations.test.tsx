import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { ReservationDetailPage } from "./reservation-detail-page";
import { ReservationsPage } from "./reservations-page";
import { NewReservationPage } from "./new-reservation-page";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { hotelToday, addIsoDays } from "@/lib/format";

const RES = {
  id: "rsv_1",
  code: "BK-1042",
  status: "pending",
  source: "website",
  guestId: "gst_1",
  guestName: "Ahmed Mohamed",
  guestPhone: null,
  guestVip: false,
  roomTypeId: "rmt_1",
  roomTypeName: "Grand Deluxe Room",
  roomId: "rom_305",
  roomNumber: "305",
  arrival: "2026-10-05",
  departure: "2026-10-08",
  nights: 3,
  adults: 2,
  children: 0,
  nightlyRates: [
    { date: "2026-10-05", rate: 5400, rule: null },
    { date: "2026-10-06", rate: 5400, rule: null },
    { date: "2026-10-07", rate: 6210, rule: "Weekend" },
  ],
  roomTotal: 17010,
  discountCode: null,
  discountAmount: 0,
  total: 17010,
  notes: "Arriving late.",
  cancellationReason: null,
  createdAt: "2026-09-27T08:00:00Z",
  commands: ["confirm", "cancel"],
  history: [
    {
      fromStatus: null,
      toStatus: "pending",
      actorName: "Youssef Adly",
      reason: null,
      at: "2026-09-27T08:00:00Z",
    },
  ],
};

function renderDetail(permissions: string[], detail: object = RES) {
  stubApi({
    permissions,
    routes: [
      (url) => (url.pathname.endsWith("/hotel/reservations/rsv_1") ? json(200, detail) : undefined),
    ],
  });
  renderApp(
    <Routes>
      <Route path="/reservations/:reservationId" element={<ReservationDetailPage />} />
    </Routes>,
    "/reservations/rsv_1",
  );
}

describe("Reservation detail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the price breakdown with the rule that priced each night", async () => {
    renderDetail(["read:reservation"]);
    expect(await screen.findByText("#BK-1042")).toBeInTheDocument();
    expect(screen.getByText("· Weekend")).toBeInTheDocument();
    // room total and grand total (no discount)
    expect(screen.getAllByText("17,010 EGP")).toHaveLength(2);
  });

  it("offers only actions the state machine allows AND the user may perform", async () => {
    renderDetail(["read:reservation", "update:reservation"]);
    expect(await screen.findByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change room" })).toBeInTheDocument();
    // Allowed by the state machine, but this user lacks cancel:reservation.
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    // Not a legal command for a pending reservation.
    expect(screen.queryByRole("button", { name: "Mark no-show" })).not.toBeInTheDocument();
  });

  it("only offers no-show once the arrival date has come", async () => {
    renderDetail(["read:reservation", "update:reservation"], {
      ...RES,
      status: "confirmed",
      arrival: "2099-01-01",
      departure: "2099-01-03",
      commands: ["check_in", "cancel", "no_show"],
    });
    await screen.findByText("#BK-1042");
    expect(screen.queryByRole("button", { name: "Mark no-show" })).not.toBeInTheDocument();
  });

  it("offers nothing on a terminal reservation", async () => {
    renderDetail(["read:reservation", "update:reservation", "cancel:reservation"], {
      ...RES,
      status: "cancelled",
      commands: [],
    });
    await screen.findByText("#BK-1042");
    for (const name of ["Confirm", "Cancel booking", "Change room", "Change dates"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});

describe("Reservations list", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("filters by status through the API", async () => {
    const fetchMock = stubApi({
      permissions: ["read:reservation"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/reservations")
            ? json(200, { items: [RES], total: 1 })
            : undefined,
      ],
    });
    renderApp(<ReservationsPage />);
    expect(await screen.findByText("Ahmed Mohamed")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Confirmed" }));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes("status=confirmed"))).toBe(true),
    );
  });
});

describe("New reservation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("books with the server's quote and never sends a price", async () => {
    const today = hotelToday();
    const availability = {
      nights: 2,
      results: [
        {
          roomType: {
            id: "rmt_1",
            code: "DLX",
            name: "Grand Deluxe Room",
            capacity: 2,
            beds: "1 King bed",
            baseRate: 5400,
            amenities: [],
          },
          availableRooms: 4,
          bookable: true,
          unavailableReason: null,
          quote: {
            nights: [
              { date: today, rate: 5400, rule: null },
              { date: addIsoDays(today, 1), rate: 5400, rule: null },
            ],
            roomTotal: 10800,
            discountCode: null,
            discountAmount: 0,
            total: 10800,
            minNights: 1,
          },
        },
      ],
    };
    let posted: Record<string, unknown> | null = null;
    stubApi({
      permissions: ["read:reservation", "create:reservation", "read:guest"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/availability") ? json(200, availability) : undefined,
        (url) =>
          url.pathname.endsWith("/hotel/availability/rooms") ? json(200, { items: [] }) : undefined,
        (url) =>
          url.pathname.endsWith("/hotel/guests")
            ? json(200, {
                items: [{ id: "gst_9", fullName: "Nourhan Adel", phone: "+20 106", email: null }],
                total: 1,
              })
            : undefined,
        (url, init) => {
          if (url.pathname.endsWith("/hotel/reservations") && init?.method === "POST") {
            posted = JSON.parse(String(init.body)) as Record<string, unknown>;
            return json(201, { ...RES, id: "rsv_new", code: "BK-1050" });
          }
          return undefined;
        },
      ],
    });
    renderApp(
      <Routes>
        <Route path="/" element={<NewReservationPage />} />
        <Route path="/reservations/:id" element={<div>booked</div>} />
      </Routes>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Grand Deluxe Room/ }));
    expect(screen.getAllByText("10,800 EGP").length).toBeGreaterThan(0);
    await user.type(screen.getByRole("searchbox", { name: "Find guest" }), "nour");
    await user.click(await screen.findByRole("button", { name: /Nourhan Adel/ }));
    await user.click(screen.getByRole("button", { name: "Book & confirm" }));
    expect(await screen.findByText("booked")).toBeInTheDocument();
    expect(posted).toMatchObject({ guestId: "gst_9", roomTypeId: "rmt_1", confirm: true });
    for (const key of ["total", "roomTotal", "price", "rate", "nightlyRates"]) {
      expect(posted).not.toHaveProperty(key);
    }
  });
});

describe("Calendar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("draws stays mid-day to mid-day and clamps them to the window", async () => {
    const from = hotelToday();
    const days = Array.from({ length: 7 }, (_, i) => addIsoDays(from, i));
    stubApi({
      permissions: ["read:reservation", "read:room"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/room-types") ? json(200, { items: [] }) : undefined,
        (url) =>
          url.pathname.endsWith("/hotel/calendar")
            ? json(200, {
                from,
                to: addIsoDays(from, 7),
                days,
                rooms: [
                  {
                    id: "rom_1",
                    number: "305",
                    floor: 3,
                    roomTypeId: "rmt_1",
                    roomTypeName: "Grand Deluxe Room",
                    roomTypeCode: "DLX",
                    bars: [
                      // starts 2 days before the window, ends on day 2 → clamped at the left edge
                      {
                        kind: "reservation",
                        start: addIsoDays(from, -2),
                        end: addIsoDays(from, 2),
                        reservationId: "rsv_a",
                        code: "BK-1",
                        status: "checked_in",
                        guestName: "Sara El-Sayed",
                        reason: null,
                      },
                      // day 2 → day 4: starts at 2.5/7 of the width
                      {
                        kind: "reservation",
                        start: addIsoDays(from, 2),
                        end: addIsoDays(from, 4),
                        reservationId: "rsv_b",
                        code: "BK-2",
                        status: "confirmed",
                        guestName: "Karim Fathy",
                        reason: null,
                      },
                    ],
                  },
                ],
              })
            : undefined,
      ],
    });
    renderApp(<CalendarPage />);
    const rooms = await screen.findByRole("list", { name: "Rooms" });
    const first = within(rooms).getByRole("link", { name: /Sara El-Sayed/ });
    const second = within(rooms).getByRole("link", { name: /Karim Fathy/ });
    // jsdom rounds percentages inside calc(); compare the percentage numerically.
    const pct = (css: string) => Number(/calc\(([\d.]+)%/.exec(css)![1]);
    expect(pct(first.style.left)).toBe(0);
    expect(pct(first.style.width)).toBeCloseTo((2.5 / 7) * 100, 3);
    expect(pct(second.style.left)).toBeCloseTo((2.5 / 7) * 100, 3);
    expect(second.getAttribute("href")).toBe("/reservations/rsv_b");
  });
});
