import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { ScoringOverview } from "../types";

export const scoringApi = {
  overview: () => http<ScoringOverview>(ENDPOINTS.scoring.base),
  publish: (body: {
    bySeverity: Record<string, number>;
    byItem: Record<string, number>;
    reason: string;
  }) => http(ENDPOINTS.scoring.base, { method: "PUT", body }),
  designate: (userId: string) =>
    http(ENDPOINTS.scoring.designees, { method: "POST", body: { userId } }),
  revoke: (userId: string) => http(ENDPOINTS.scoring.designee(userId), { method: "DELETE" }),
};
