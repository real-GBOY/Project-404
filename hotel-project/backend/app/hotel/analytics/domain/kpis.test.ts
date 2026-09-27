import { describe, expect, it } from "vitest";
import { nightOccupancyPct, performance, shares } from "./kpis.js";

describe("hotel KPIs", () => {
  const nights = [
    { day: "2026-10-01", sold: 6, blocked: 0, roomRevenue: 30000, extrasRevenue: 1200 },
    { day: "2026-10-02", sold: 8, blocked: 2, roomRevenue: 44000, extrasRevenue: 800 },
  ];

  it("computes occupancy, ADR and RevPAR from room-nights, excluding blocked rooms", () => {
    // 10 rooms: available = 10 + 8 = 18 room-nights; sold = 14.
    expect(performance(nights, 10)).toEqual({
      occupancyPct: 77.8,
      adr: 5285.71, // 74,000 ÷ 14
      revpar: 4111.11, // 74,000 ÷ 18
      roomNightsSold: 14,
      roomNightsAvailable: 18,
      roomRevenue: 74000,
      extrasRevenue: 2000,
      totalRevenue: 76000,
    });
    expect(nightOccupancyPct(nights[1]!, 10)).toBe(100);
  });

  it("is all zeros for an empty hotel, never NaN", () => {
    expect(performance([{ ...nights[0]!, sold: 0, roomRevenue: 0 }], 0)).toMatchObject({
      occupancyPct: 0,
      adr: 0,
      revpar: 0,
    });
  });

  it("splits shares that always add up to exactly 100%", () => {
    const s = shares([
      { key: "a", value: 1 },
      { key: "b", value: 1 },
      { key: "c", value: 1 },
    ]);
    expect(s.map((x) => x.pct)).toEqual([33.4, 33.3, 33.3]);
    expect(shares([{ key: "a", value: 0 }]).map((x) => x.pct)).toEqual([0]);
  });
});
