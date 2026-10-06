import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { Severity, TrainingReason, TrainingRequest } from "../types";

export const trainingApi = {
  list: () => allPages<TrainingRequest>(ENDPOINTS.training.list).then((r) => r.items),
  get: (id: string) => http<TrainingRequest>(ENDPOINTS.training.byId(id)),
  create: (b: {
    guardId: string;
    reason: TrainingReason;
    course: string;
    related: string;
    priority: Severity;
    notes: string;
  }) => http<TrainingRequest>(ENDPOINTS.training.list, { method: "POST", body: b }),
  step: (
    id: string,
    step: "approve" | "return" | "reject" | "resubmit" | "schedule" | "complete",
    body: Record<string, unknown> = {},
  ) => http<TrainingRequest>(ENDPOINTS.training.step(id, step), { method: "POST", body }),
};
