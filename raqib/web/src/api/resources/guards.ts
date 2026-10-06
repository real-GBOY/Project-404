import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Guard, GuardHistory, GuardInput, GuardSummaries } from "../types";

export const guardsApi = {
  list: () => http<{ items: Guard[] }>(ENDPOINTS.guards.list).then((r) => r.items),
  history: (id: string) => http<GuardHistory>(ENDPOINTS.guardHistory(id)),
  summary: () => http<{ items: GuardSummaries }>(ENDPOINTS.guardSummary).then((r) => r.items),
  create: (input: GuardInput) =>
    http<Guard>(ENDPOINTS.guards.list, { method: "POST", body: input }),
  /** The employee number never changes; a blank national ID is simply left out so the stored one stays. */
  update: (id: string, patch: Partial<Omit<GuardInput, "employeeNo">>) =>
    http<Guard>(ENDPOINTS.guards.byId(id), { method: "PATCH", body: patch }),
  setStatus: (id: string, status: Guard["status"]) =>
    http<Guard>(ENDPOINTS.guards.status(id), { method: "POST", body: { status } }),
};
