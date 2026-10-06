import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Inspection } from "../types";

export const reviewApi = {
  decide: (
    visitId: string,
    action: "forward" | "return" | "reject" | "approve",
    body: { reason?: string; comment?: string; itemIds?: string[] },
  ) => http<Inspection>(ENDPOINTS.review(visitId, action), { method: "POST", body }),
};
