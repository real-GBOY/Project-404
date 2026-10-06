import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Guard training requests. */
export const trainingActions = (qc: Qc): Slice<"requestTraining" | "trainingStep"> => ({
  async requestTraining(input) {
    const t = await api.training.create(input);
    await invalidate(qc, QK.training, QK.guardHistory);
    return t;
  },
  async trainingStep(id, step, body) {
    qc.setQueryData([QK.trainingOne, id], await api.training.step(id, step, body ?? {}));
    await invalidate(qc, QK.training, QK.guardHistory);
  },
});
