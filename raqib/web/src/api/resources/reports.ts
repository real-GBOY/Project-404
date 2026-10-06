import { API_BASE_URL, ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { Report } from "../types";

export const reportsApi = {
  list: () => allPages<Report>(ENDPOINTS.reports.list),
  /** The report as one self-contained, print-ready page, fetched with the caller's credentials. The browser makes the PDF. */
  html: async (id: string, lang: "ar" | "en"): Promise<string> => {
    const r = await fetch(`${API_BASE_URL}${ENDPOINTS.reports.html(id, lang)}`, {
      headers: http.bearerHeaders(),
    });
    if (!r.ok) throw Object.assign(new Error(`report ${r.status}`), { status: r.status });
    return r.text();
  },
};
