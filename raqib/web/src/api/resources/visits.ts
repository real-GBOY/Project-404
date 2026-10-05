import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { CreateVisitInput, EligibleInspector, RescheduleVisitInput, Visit } from "../types";

export const visitsApi = {
  list: () => allPages<Visit>(ENDPOINTS.visits.list).then((r) => r.items),
  get: (id: string) => http<Visit>(ENDPOINTS.visits.byId(id)),
  create: (input: CreateVisitInput) =>
    http<Visit>(ENDPOINTS.visits.list, { method: "POST", body: input }),
  reschedule: (id: string, input: RescheduleVisitInput) =>
    http<Visit>(ENDPOINTS.visits.reschedule(id), { method: "POST", body: input }),
  cancel: (id: string, reason: string) =>
    http<Visit>(ENDPOINTS.visits.cancel(id), { method: "POST", body: { reason } }),
  eligibleInspectors: (projectId: string, date: string) =>
    http<{ items: EligibleInspector[] }>(ENDPOINTS.visits.inspectors, {
      query: { projectId, date },
    }).then((r) => r.items),
};
