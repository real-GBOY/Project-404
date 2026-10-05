import { api } from "@/api";
import { saveBlob } from "@/presenters/screens/reports";
import type { Slice } from "./shared";

/** Downloads: exports, report PDFs and the bytes of an evidence file. */
export const documentActions = (): Slice<
  "exportAnalytics" | "exportAudit" | "reportPdf" | "evidenceBlob"
> => ({
  async exportAnalytics(q) {
    saveBlob(await api.analytics.exportCsv(q), "raqib-analytics.csv");
  },
  async exportAudit(q) {
    saveBlob(await api.audit.exportCsv(q), "raqib-audit.csv");
  },
  reportPdf: (id, lang) => api.reports.pdf(id, lang),
  evidenceBlob: (id) => api.evidence.blob(id),
});
