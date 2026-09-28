import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { addDays } from "@hotel/hotel/shared/dates.js";
import { fromPiastres, toPiastres } from "@hotel/hotel/shared/money.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { nightOccupancyPct, performance, shares } from "../domain/kpis.js";
import { AnalyticsRepository } from "../infrastructure/analytics-repository.js";

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/**
 * Analytics (design: "Analytics"): performance over the last 7 / 30 / 90 nights up to and
 * including tonight, compared with the period before it. Every figure is derived from the
 * ledgers on request (see domain/kpis.ts for the definitions).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly settings: SettingsService,
  ) {}

  overview(days: AnalyticsRange) {
    return readInTenant(async () => {
      const today = await this.settings.today();
      const to = addDays(today, 1);
      const from = addDays(to, -days);
      const previousFrom = addDays(from, -days);
      const [nights, previousNights, rooms, arrivals, methods] = await Promise.all([
        this.repo.nights(from, to),
        this.repo.nights(previousFrom, from),
        this.repo.roomCount(),
        this.repo.arrivals(from, to),
        this.repo.paymentMethods(from, to),
      ]);
      const current = performance(nights, rooms);
      const previous = performance(previousNights, rooms);
      return {
        range: { days, from, to },
        performance: current,
        previous: {
          occupancyPct: previous.occupancyPct,
          adr: previous.adr,
          revpar: previous.revpar,
          totalRevenue: previous.totalRevenue,
        },
        bookings: arrivals.bookings,
        avgStayNights: arrivals.avgNights,
        cancellationRatePct:
          arrivals.bookings > 0
            ? Math.round((arrivals.cancelled / arrivals.bookings) * 1000) / 10
            : 0,
        noShowRatePct:
          arrivals.bookings > 0
            ? Math.round((arrivals.noShows / arrivals.bookings) * 1000) / 10
            : 0,
        series: nights.map((n) => ({
          date: n.day,
          occupancyPct: nightOccupancyPct(n, rooms),
          roomRevenue: n.roomRevenue,
          totalRevenue: fromPiastres(toPiastres(n.roomRevenue) + toPiastres(n.extrasRevenue)),
        })),
        sources: shares(arrivals.sources.map((s) => ({ key: s.source, value: s.bookings }))).map(
          (s, i) => ({
            source: s.key,
            bookings: s.value,
            revenue: arrivals.sources[i]!.revenue,
            pct: s.pct,
          }),
        ),
        paymentMethods: shares(methods.map((m) => ({ key: m.method, value: m.amount }))).map(
          (m) => ({ method: m.key, amount: m.value, pct: m.pct }),
        ),
      };
    });
  }
}
