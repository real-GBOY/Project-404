import { api } from "@/api";
import { saveBlob } from "@/presenters/screens/reports";
import type { Slice } from "./shared";

/** Downloads: exports, report PDFs and the bytes of an evidence file. */
export const documentActions = (): Slice<
  "exportAnalytics" | "exportAudit" | "reportPdf" | "evidenceBlob"
> => ({
  async exportAnalytics(q, format) {
    saveBlob(await api.analytics.exportFile(q, format), `raqib-analytics.${format}`);
  },
  async exportAudit(q, format) {
    saveBlob(await api.audit.exportFile(q, format), `raqib-audit.${format}`);
  },
  reportPdf: (id, lang) => api.reports.pdf(id, lang),
  evidenceBlob: (id) => api.evidence.blob(id),
});
