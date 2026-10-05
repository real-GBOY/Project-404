import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Reviewing account requests. */
export const onboardingActions = (
  qc: Qc,
): Slice<"approveRequest" | "rejectRequest" | "resendRequest"> => ({
  async approveRequest(id, input) {
    qc.setQueryData([QK.accountRequest, id], await api.accountRequests.approve(id, input));
    await invalidate(qc, QK.accountRequests, QK.users);
  },
  async rejectRequest(id, reason) {
    qc.setQueryData([QK.accountRequest, id], await api.accountRequests.reject(id, reason));
    await invalidate(qc, QK.accountRequests);
  },
  async resendRequest(id) {
    await api.accountRequests.resend(id);
  },
});
