import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** The form builder. */
export const formActions = (
  qc: Qc,
): Slice<
  "createForm" | "createDraft" | "saveDraft" | "discardDraft" | "publishForm" | "setFormActive"
> => ({
  async createForm(input) {
    const f = await api.forms.create(input);
    await invalidate(qc, QK.forms);
    return { id: f.id };
  },
  async createDraft(formId) {
    await api.forms.createDraft(formId);
    await invalidate(qc, QK.forms);
  },
  async saveDraft(formId, sections) {
    await api.forms.saveDraft(formId, sections);
    await invalidate(qc, QK.forms);
  },
  async discardDraft(formId) {
    await api.forms.discardDraft(formId);
    await invalidate(qc, QK.forms);
  },
  async publishForm(formId, reason) {
    await api.forms.publish(formId, reason);
    await invalidate(qc, QK.forms);
  },
  async setFormActive(formId, active, reason) {
    await api.forms.setActive(formId, active, reason);
    await invalidate(qc, QK.forms);
  },
});
