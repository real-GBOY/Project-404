import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { Observation, Severity } from "../types";

export const observationsApi = {
  list: () => allPages<Observation>(ENDPOINTS.observations.list).then((r) => r.items),
  create: (b: {
    projectId: string;
    siteId: string;
    text: string;
    note?: string;
    severity: Severity;
  }) => http<Observation>(ENDPOINTS.observations.create, { method: "POST", body: b }),
};
