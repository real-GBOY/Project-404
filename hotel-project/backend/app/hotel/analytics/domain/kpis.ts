import { fromPiastres, toPiastres } from "@hotel/hotel/shared/money.js";

/**
 * Hotel performance measures — pure functions of per-night figures, using the industry's
 * standard definitions:
 *
 *   occupancy = room-nights sold ÷ room-nights available        (blocked rooms are not available)
 *   ADR       = room revenue ÷ room-nights sold                  (average daily rate)
 *   RevPAR    = room revenue ÷ room-nights available             (= ADR × occupancy)
 *
 * Room revenue is room charges only (pre-VAT); extras (breakfast, minibar, …) are reported
 * separately so they don't inflate the room rate.
 */
export interface Night {
  day: string;
  sold: number;
  blocked: number;
  roomRevenue: number;
  extrasRevenue: number;
}

export interface Performance {
  occupancyPct: number;
  adr: number;
  revpar: number;
  roomNightsSold: number;
  roomNightsAvailable: number;
  roomRevenue: number;
  extrasRevenue: number;
  totalRevenue: number;
}

const pct1 = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const money = (piastres: number) => fromPiastres(Math.round(piastres));

/** Occupancy for one night, as the dashboard and analytics both show it. */
export function nightOccupancyPct(night: Pick<Night, "sold" | "blocked">, rooms: number): number {
  return pct1(night.sold, Math.max(rooms - night.blocked, 0));
}

export function performance(nights: Night[], rooms: number): Performance {
  const sold = nights.reduce((s, n) => s + n.sold, 0);
  const available = nights.reduce((s, n) => s + Math.max(rooms - n.blocked, 0), 0);
  const roomP = nights.reduce((s, n) => s + toPiastres(n.roomRevenue), 0);
  const extrasP = nights.reduce((s, n) => s + toPiastres(n.extrasRevenue), 0);
  return {
    occupancyPct: pct1(sold, available),
    adr: sold > 0 ? money(roomP / sold) : 0,
    revpar: available > 0 ? money(roomP / available) : 0,
    roomNightsSold: sold,
    roomNightsAvailable: available,
    roomRevenue: fromPiastres(roomP),
    extrasRevenue: fromPiastres(extrasP),
    totalRevenue: fromPiastres(roomP + extrasP),
  };
}

/** Shares that add up to exactly 100 (largest-remainder rounding to one decimal). */
export function shares<K extends string>(
  items: Array<{ key: K; value: number }>,
): Array<{ key: K; value: number; pct: number }> {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return items.map((i) => ({ ...i, pct: 0 }));
  const raw = items.map((i) => (i.value / total) * 1000);
  const floors = raw.map(Math.floor);
  let left = 1000 - floors.reduce((s, f) => s + f, 0);
  const order = raw.map((r, i) => ({ i, frac: r - floors[i]! })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]!++;
    left--;
  }
  return items.map((it, i) => ({ ...it, pct: floors[i]! / 10 }));
}
