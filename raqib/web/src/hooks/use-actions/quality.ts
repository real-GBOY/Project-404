import { api } from "@/api";
import { uploadToStorage } from "@/api/uploads";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Corrective actions on observations, including their closure evidence. */
export const qualityActions = (
  qc: Qc,
): Slice<
  "assignAction" | "actionStep" | "commentAction" | "uploadActionEvidence" | "removeActionEvidence"
> => ({
  async assignAction(observationId, input) {
    const a = await api.actions.create(observationId, input);
    await invalidate(qc, QK.observations, QK.actions);
    return a;
  },
  async actionStep(id, step, body) {
    qc.setQueryData([QK.action, id], await api.actions.step(id, step, body ?? {}));
    await invalidate(qc, QK.observations, QK.actions);
  },
  async commentAction(id, text) {
    qc.setQueryData([QK.action, id], await api.actions.comment(id, text));
  },
  async uploadActionEvidence(file, actionId, onProgress) {
    const fileId = await uploadToStorage(file, onProgress);
    await api.evidence.attach({ fileId, actionId });
    qc.setQueryData([QK.action, actionId], await api.actions.get(actionId));
  },
  async removeActionEvidence(actionId, evidenceId) {
    await api.evidence.remove(evidenceId);
    qc.setQueryData([QK.action, actionId], await api.actions.get(actionId));
  },
});
