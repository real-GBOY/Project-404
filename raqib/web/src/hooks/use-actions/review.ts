import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, putInspection, type Qc, type Slice } from "./shared";

/** Review and approval of a submitted inspection. */
export const reviewActions = (qc: Qc): Slice<"decideReview"> => ({
  async decideReview(visitId, action, body) {
    putInspection(qc, visitId, await api.review.decide(visitId, action, body));
    await invalidate(qc, QK.visits);
  },
});
