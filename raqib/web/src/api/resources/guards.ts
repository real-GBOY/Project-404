import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Guard, GuardHistory, GuardSummaries } from "../types";

export const guardsApi = {
  list: () => http<{ items: Guard[] }>(ENDPOINTS.guards.list).then((r) => r.items),
  history: (id: string) => http<GuardHistory>(ENDPOINTS.guardHistory(id)),
  summary: () => http<{ items: GuardSummaries }>(ENDPOINTS.guardSummary).then((r) => r.items),
};
