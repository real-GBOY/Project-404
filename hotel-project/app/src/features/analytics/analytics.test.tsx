import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { AnalyticsPage } from "./analytics-page";

const report = (days: number) => ({
  range: { days, from: "2026-09-01", to: "2026-10-01" },
  performance: {
    occupancyPct: 62.5,
    adr: 5285.71,
    revpar: 3303.57,
    roomNightsSold: 750,
    roomNightsAvailable: 1200,
    roomRevenue: 3964285,
    extrasRevenue: 210000,
    totalRevenue: 4174285,
  },
  previous: { occupancyPct: 58, adr: 5000, revpar: 2900, totalRevenue: 3800000 },
  bookings: 310,
  avgStayNights: 2.4,
  cancellationRatePct: 6.1,
  noShowRatePct: 1.9,
  series: Array.from({ length: days }, (_, i) => ({
    date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
    occupancyPct: 50 + (i % 20),
    roomRevenue: 100000 + i * 1000,
    totalRevenue: 105000 + i * 1000,
  })),
  sources: [
    { source: "booking_com", bookings: 124, revenue: 1600000, pct: 40 },
    { source: "website", bookings: 93, revenue: 1200000, pct: 30 },
    { source: "walk_in", bookings: 93, revenue: 1100000, pct: 30 },
  ],
  paymentMethods: [
    { method: "card", amount: 3000000, pct: 75 },
    { method: "cash", amount: 1000000, pct: 25 },
  ],
});

describe("Analytics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the design's KPIs with comparisons, and switches range on the server", async () => {
    const asked: string[] = [];
    stubApi({
      permissions: ["read:analytics"],
      routes: [
        (url) => {
          if (!url.pathname.endsWith("/hotel/analytics")) return undefined;
          const days = url.searchParams.get("days")!;
          asked.push(days);
          return json(200, report(Number(days)));
        },
      ],
    });
    renderApp(<AnalyticsPage />, "/analytics");
    const adr = await screen.findByLabelText("ADR");
    expect(adr).toHaveTextContent("5,286 EGP");
    expect(adr).toHaveTextContent("↑ 5.7% vs previous");
    expect(screen.getByLabelText("Cancellation Rate")).toHaveTextContent("6.1%");
    expect(screen.getByLabelText("Booking.com 40%")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Revenue Over Time" }).children).toHaveLength(30);
    // Occupancy compares in percentage points, not percent.
    expect(screen.getByText(/↑ 4.5 pts vs previous/)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: "90d" }));
    await vi.waitFor(() =>
      expect(screen.getByRole("list", { name: "Revenue Over Time" }).children).toHaveLength(90),
    );
    expect(asked).toEqual(["30", "90"]);
  });
});
