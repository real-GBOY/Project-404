import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { HousekeepingPage } from "@/features/housekeeping/housekeeping-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { MaintenancePage } from "./maintenance-page";
import { TicketDetailPage } from "./ticket-detail-page";

const task = (over: Record<string, unknown>) => ({
  id: "hkt_1",
  roomId: "rom_1",
  roomNumber: "305",
  floor: 3,
  roomTypeName: "Grand Deluxe Room",
  reservationId: null,
  kind: "checkout_clean",
  status: "pending",
  priority: "normal",
  assigneeId: null,
  assigneeName: null,
  notes: null,
  dueDate: "2026-09-27",
  startedAt: null,
  completedAt: null,
  inspectedAt: null,
  commands: ["assign", "start"],
  ...over,
});

const TASKS = [
  task({}),
  task({ id: "hkt_2", roomNumber: "210", status: "in_progress", commands: ["complete"] }),
  task({ id: "hkt_3", roomNumber: "118", status: "completed", commands: ["inspect"] }),
];

const TICKET = {
  id: "mtk_1",
  number: "MT-101",
  roomId: "rom_1",
  roomNumber: "305",
  roomTypeName: "Grand Deluxe Room",
  title: "AC not cooling",
  description: null,
  priority: "high",
  status: "resolved",
  assigneeId: "usr_tech",
  assigneeName: "Omar Tarek",
  cost: 850,
  roomImpact: "out_of_service",
  expectedBack: "2026-09-30",
  resolutionNotes: "Compressor replaced",
  createdAt: "2026-09-26T08:00:00Z",
  commands: ["reopen", "verify"],
  reportedByName: "Mona Farid",
  timeline: [
    { kind: "reported", body: null, actorName: "Mona Farid", at: "2026-09-26T08:00:00Z" },
    {
      kind: "resolved",
      body: "Compressor replaced",
      actorName: "Omar Tarek",
      at: "2026-09-27T08:00:00Z",
    },
  ],
};

describe("Housekeeping board", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sorts tasks into the design's three columns and starts cleaning through the task", async () => {
    const posted: string[] = [];
    stubApi({
      permissions: ["read:housekeeping", "update:housekeeping"],
      routes: [
        (url, init) => {
          if (init?.method === "POST") {
            posted.push(url.pathname);
            return json(200, task({ status: "in_progress" }));
          }
          if (url.pathname.endsWith("/hotel/housekeeping/tasks")) {
            expect(url.searchParams.get("board")).toBe("true");
            return json(200, { items: TASKS });
          }
          return undefined;
        },
      ],
    });
    renderApp(<HousekeepingPage />);
    const needs = await screen.findByRole("region", { name: "Needs Cleaning" });
    expect(within(needs).getByText("Room 305")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Cleaning" })).getByText("Room 210"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Ready" })).getByText("Room 118"),
    ).toBeInTheDocument();
    // A housekeeper works tasks but doesn't assign or inspect.
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inspect" })).not.toBeInTheDocument();

    await userEvent.setup().click(within(needs).getByRole("button", { name: "Start Cleaning" }));
    expect(posted).toEqual(["/api/hotel/housekeeping/tasks/hkt_1/start"]);
  });
});

describe("Maintenance", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists tickets with room, assignee, priority and when a blocked room is back", async () => {
    stubApi({
      permissions: ["read:maintenance"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/maintenance/tickets")
            ? json(200, { items: [{ ...TICKET, status: "in_progress" }] })
            : undefined,
      ],
    });
    renderApp(<MaintenancePage />);
    expect(await screen.findByText("AC not cooling")).toBeInTheDocument();
    expect(
      screen.getByText("Room 305 · Omar Tarek · Out Of Service until Sep 30"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Report Issue" })).not.toBeInTheDocument();
  });

  it("offers Verify & Return to Service only to a supervisor", async () => {
    const detailRoute = (url: URL) =>
      url.pathname.endsWith("/hotel/maintenance/tickets/mtk_1") ? json(200, TICKET) : undefined;
    const page = (
      <Routes>
        <Route path="/maintenance/:ticketId" element={<TicketDetailPage />} />
      </Routes>
    );

    stubApi({ permissions: ["read:maintenance", "update:maintenance"], routes: [detailRoute] });
    const tech = renderApp(page, "/maintenance/mtk_1");
    expect(await screen.findByText("Compressor replaced", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verify/ })).not.toBeInTheDocument();
    tech.unmount();
    vi.unstubAllGlobals();

    stubApi({
      permissions: ["read:maintenance", "update:maintenance", "manage:maintenance"],
      routes: [detailRoute],
    });
    renderApp(page, "/maintenance/mtk_1");
    expect(
      await screen.findByRole("button", { name: "Verify & Return to Service" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extend Block" })).toBeInTheDocument();
  });
});

describe("Dashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

  const DASH = {
    date: "2026-09-27",
    kpis: {
      occupancyPct: 74.2,
      occupancyDelta: 3.1,
      revenueToday: 32450,
      revenueDelta: null,
      arrivals: { total: 8, pending: 5 },
      departures: { total: 6, pending: 2 },
      availableRooms: 9,
      totalRooms: 40,
      outstanding: 18500,
    },
    trend: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-09-2${i + 1}`,
      occupancyPct: 60 + i,
      revenue: 20000 + i * 1000,
    })),
    roomStatus: {
      available: 9,
      reserved: 5,
      occupied: 22,
      dirty: 2,
      cleaning: 1,
      maintenance: 0,
      out_of_service: 1,
    },
    alerts: [
      { type: "maintenance", text: "Room 305: AC not cooling (high)", href: "/maintenance/mtk_1" },
    ],
    recentReservations: [],
  };

  it("shows the hotel-wide KPIs from the server", async () => {
    stubApi({
      permissions: ["read:dashboard"],
      routes: [(url) => (url.pathname.endsWith("/hotel/dashboard") ? json(200, DASH) : undefined)],
    });
    renderApp(<DashboardPage />);
    const occupancy = await screen.findByLabelText("Occupancy");
    expect(occupancy).toHaveTextContent("74.2%");
    expect(occupancy).toHaveTextContent("↑ 3.1% vs yesterday");
    expect(screen.getByLabelText("Arrivals")).toHaveTextContent("5 pending check-in");
    expect(screen.getByLabelText("Available Rooms")).toHaveTextContent("of 40 total");
    expect(screen.getByRole("link", { name: /AC not cooling/ })).toHaveAttribute(
      "href",
      "/maintenance/mtk_1",
    );
    expect(screen.getByText("26,000 EGP today")).toBeInTheDocument();
  });

  it("gives housekeeping staff their own queue instead of hotel figures", async () => {
    const fetchMock = stubApi({
      permissions: ["read:housekeeping", "update:housekeeping"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/housekeeping/tasks")
            ? json(200, { items: [task({ assigneeId: "usr_me", status: "assigned" })] })
            : undefined,
      ],
    });
    renderApp(<DashboardPage />);
    expect(await screen.findByText("Your rooms today")).toBeInTheDocument();
    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/hotel/dashboard"))).toBe(false);
  });
});
