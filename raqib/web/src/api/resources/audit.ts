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
  exportCsv: async (q: AuditQueryParams): Promise<Blob> => {
    const r = await fetch(`${API_BASE_URL}${ENDPOINTS.auditExport(auditQs(q))}`, {
      headers: http.bearerHeaders(),
    });
    if (!r.ok) throw new Error(`export ${r.status}`);
    return r.blob();
  },
};
