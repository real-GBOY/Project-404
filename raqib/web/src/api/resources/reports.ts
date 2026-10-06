import { API_BASE_URL, ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { Report } from "../types";

export const reportsApi = {
  list: () => allPages<Report, { pdf: boolean }>(ENDPOINTS.reports.list),
  /** The rendered PDF, fetched with the caller's credentials. */
  pdf: async (id: string, lang: "ar" | "en"): Promise<Blob> => {
    const r = await fetch(`${API_BASE_URL}${ENDPOINTS.reports.pdf(id, lang)}`, {
      headers: http.bearerHeaders(),
    });
    if (!r.ok) throw Object.assign(new Error(`pdf ${r.status}`), { status: r.status });
    return r.blob();
  },
};
