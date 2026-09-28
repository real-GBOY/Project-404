import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";
import type { PaymentMethod } from "./billing";
import type { ReservationSource } from "./reservations";

export type AnalyticsRange = 7 | 30 | 90;

export interface Analytics {
  range: { days: AnalyticsRange; from: string; to: string };
  performance: {
    occupancyPct: number;
    adr: number;
    revpar: number;
    roomNightsSold: number;
    roomNightsAvailable: number;
    roomRevenue: number;
    extrasRevenue: number;
    totalRevenue: number;
  };
  previous: { occupancyPct: number; adr: number; revpar: number; totalRevenue: number };
  bookings: number;
  avgStayNights: number;
  cancellationRatePct: number;
  noShowRatePct: number;
  series: Array<{ date: string; occupancyPct: number; roomRevenue: number; totalRevenue: number }>;
  sources: Array<{ source: ReservationSource; bookings: number; revenue: number; pct: number }>;
  paymentMethods: Array<{ method: PaymentMethod; amount: number; pct: number }>;
}

export function useAnalytics(days: AnalyticsRange) {
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: () => http<Analytics>(ENDPOINTS.analytics, { query: { days: String(days) } }),
    placeholderData: keepPreviousData,
  });
}
