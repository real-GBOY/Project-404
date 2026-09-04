import { httpClient } from "@/lib/api/http-client";
import type { DashboardData } from "../types/dashboard";

export const dashboardKeys = {
  root: ["dashboard"] as const,
};

/** `GET /api/dashboard` — read-composition layer (decision #15), served by DashboardService. */
export function getDashboard(signal?: AbortSignal): Promise<DashboardData> {
  return httpClient<DashboardData>("/dashboard", { signal });
}
