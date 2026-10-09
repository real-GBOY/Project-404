import { API_BASE_URL, ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type {
  CreateVisitInput,
  EligibleInspector,
  RescheduleVisitInput,
  ShiftDef,
  Visit,
  FormOption,
} from "../types";

export const visitsApi = {
  list: () => allPages<Visit>(ENDPOINTS.visits.list).then((r) => r.items),
  get: (id: string) => http<Visit>(ENDPOINTS.visits.byId(id)),
  create: (input: CreateVisitInput) =>
    http<Visit>(ENDPOINTS.visits.list, { method: "POST", body: input }),
  reschedule: (id: string, input: RescheduleVisitInput) =>
    http<Visit>(ENDPOINTS.visits.reschedule(id), { method: "POST", body: input }),
  cancel: (id: string, reason: string) =>
    http<Visit>(ENDPOINTS.visits.cancel(id), { method: "POST", body: { reason } }),
  /** The schedule of a period as a CSV download, or as a print-ready page (the browser makes the PDF). */
  schedule: async (
    kind: "export" | "print",
    q: { from: string; to: string; lang: "ar" | "en" },
  ): Promise<Blob | string> => {
    const qs = new URLSearchParams(q).toString();
    const r = await fetch(`${API_BASE_URL}${ENDPOINTS.visits.schedule(kind, qs)}`, {
      headers: http.bearerHeaders(),
    });
    if (!r.ok) throw new Error(`schedule ${r.status}`);
    return kind === "export" ? r.blob() : r.text();
  },
  formOptions: () =>
    http<{ items: FormOption[] }>(ENDPOINTS.visits.formOptions).then((r) => r.items),
  shifts: () => http<{ items: ShiftDef[] }>(ENDPOINTS.visits.shifts).then((r) => r.items),
  eligibleInspectors: (projectId: string, date: string) =>
    http<{ items: EligibleInspector[] }>(ENDPOINTS.visits.inspectors, {
      query: { projectId, date },
    }).then((r) => r.items),
};
