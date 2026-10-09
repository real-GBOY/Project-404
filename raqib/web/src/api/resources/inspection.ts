import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Answer, Inspection, VisitFormProgress } from "../types";

export const inspectionApi = {
  get: (visitId: string, formId?: string) =>
    http<Inspection>(ENDPOINTS.inspection.base(visitId), {
      query: formId ? { formId } : undefined,
    }),
  start: (visitId: string, formId?: string) =>
    http<Inspection>(ENDPOINTS.inspection.start(visitId), {
      method: "POST",
      query: formId ? { formId } : undefined,
    }),
  forms: (visitId: string) =>
    http<{ items: VisitFormProgress[] }>(ENDPOINTS.inspection.forms(visitId)).then((r) => r.items),
  answer: (
    visitId: string,
    itemId: string,
    patch: { value?: Answer; note?: string | null; severity?: "low" | "medium" | "high" | null },
  ) =>
    http<Inspection>(ENDPOINTS.inspection.answer(visitId, itemId), {
      method: "PUT",
      body: patch,
    }),
  guardScore: (visitId: string, guardId: string, itemId: string, score: number) =>
    http<Inspection>(ENDPOINTS.inspection.guardScore(visitId, guardId, itemId), {
      method: "PUT",
      body: { score },
    }),
  guardNote: (visitId: string, guardId: string, note: string) =>
    http<Inspection>(ENDPOINTS.inspection.guardNote(visitId, guardId), {
      method: "PUT",
      body: { note },
    }),
  submit: (visitId: string) =>
    http<Inspection>(ENDPOINTS.inspection.submit(visitId), { method: "POST" }),
};
