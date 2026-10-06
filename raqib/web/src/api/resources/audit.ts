import { API_BASE_URL, ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { AuditQueryParams, AuditResult } from "../types";

function auditQs(q: AuditQueryParams): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  return p.toString();
}

export const auditApi = {
  list: (q: AuditQueryParams) => http<AuditResult>(ENDPOINTS.audit(auditQs(q))),
  /** The current filters as a download: `.csv` or a native Excel workbook. */
  exportFile: async (q: AuditQueryParams, format: "csv" | "xlsx"): Promise<Blob> => {
    const r = await fetch(
      `${API_BASE_URL}${ENDPOINTS.auditExport(auditQs(q), format === "xlsx" ? ".xlsx" : "")}`,
      {
        headers: http.bearerHeaders(),
      },
    );
    if (!r.ok) throw new Error(`export ${r.status}`);
    return r.blob();
  },
};
