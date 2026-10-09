import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Survey, SurveyInput, SurveyList } from "../types";

export const surveysApi = {
  list: () => http<SurveyList>(ENDPOINTS.surveys.base),
  create: (b: SurveyInput) => http<Survey>(ENDPOINTS.surveys.base, { method: "POST", body: b }),
  publish: (id: string) =>
    http<Survey>(`${ENDPOINTS.surveys.base}/${id}/publish`, { method: "POST" }),
  close: (id: string) => http<Survey>(`${ENDPOINTS.surveys.base}/${id}/close`, { method: "POST" }),
  answer: (
    id: string,
    b: {
      answers: Record<string, string | number>;
      identity: "named" | "confidential" | "anonymous";
    },
  ) =>
    http<{ ref: string }>(`${ENDPOINTS.surveys.base}/${id}/answers`, { method: "POST", body: b }),
  name: (userId: string) =>
    http<void>(`${ENDPOINTS.surveys.base}/managers`, { method: "POST", body: { userId } }),
  unname: (userId: string) =>
    http<void>(`${ENDPOINTS.surveys.base}/managers/${userId}`, { method: "DELETE" }),
};
