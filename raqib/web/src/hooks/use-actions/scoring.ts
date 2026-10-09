import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Deduction scoring: publishing the approved values, and naming who may do so. */
export const scoringActions = (
  qc: Qc,
): Slice<"publishScoring" | "designateScoring" | "revokeScoring"> => ({
  async publishScoring(body) {
    await api.scoring.publish(body);
    await invalidate(qc, QK.scoring);
  },
  async designateScoring(userId) {
    await api.scoring.designate(userId);
    await invalidate(qc, QK.scoring);
  },
  async revokeScoring(userId) {
    await api.scoring.revoke(userId);
    await invalidate(qc, QK.scoring);
  },
});
