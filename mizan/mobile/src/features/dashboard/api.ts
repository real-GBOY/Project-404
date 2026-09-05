import { httpClient } from "@/lib/api/http-client";
import type { DashboardData } from "./types";

export const dashboardKeys = {
  root: ["dashboard"] as const,
};

/** `GET /api/dashboard` — same read-composition endpoint the web app uses. */
export function getDashboard(signal?: AbortSignal): Promise<DashboardData> {
  return httpClient<DashboardData>("/dashboard", { signal });
}
