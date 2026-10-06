import { API_BASE_URL, ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { AnalyticsQueryParams, AnalyticsResult } from "../types";

/** Analytics filters as a query string (empty values are left out; custom dates only apply to a custom period). */
function analyticsQs(q: AnalyticsQueryParams): string {
  const p = new URLSearchParams({ period: q.period });
  if (q.period === "custom") {
    if (q.from) p.set("from", q.from);
    if (q.to) p.set("to", q.to);
  }
  if (q.projectId) p.set("projectId", q.projectId);
  if (q.siteId) p.set("siteId", q.siteId);
  return p.toString();
}

export const analyticsApi = {
  get: (q: AnalyticsQueryParams) => http<AnalyticsResult>(ENDPOINTS.analytics(analyticsQs(q))),
  /** The current filters as a download: `.csv` or a native Excel workbook. */
  exportFile: async (q: AnalyticsQueryParams, format: "csv" | "xlsx"): Promise<Blob> => {
    const r = await fetch(
      `${API_BASE_URL}${ENDPOINTS.analyticsExport(analyticsQs(q), format === "xlsx" ? ".xlsx" : "")}`,
      {
        headers: http.bearerHeaders(),
      },
    );
    if (!r.ok) throw new Error(`export ${r.status}`);
    return r.blob();
  },
};
