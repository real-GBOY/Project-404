import { api } from "@/api";
import { uploadToStorage } from "@/api/uploads";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** The confidential reporting area: reports, the access session, grants. */
export const confidentialActions = (
  qc: Qc,
): Slice<
  | "confSubmit"
  | "confUpload"
  | "confEnter"
  | "confExit"
  | "confRespond"
  | "confReveal"
  | "confIssueGrant"
  | "confRevoke"
> => ({
  async confSubmit(input) {
    const r = await api.conf.submit(input);
    await invalidate(qc, QK.confMine);
    return r;
  },
  confUpload: (file, onProgress) => uploadToStorage(file, onProgress),
  async confEnter(reason, ack) {
    await api.conf.enter(reason, ack);
    await invalidate(qc, QK.confAccess);
  },
  async confExit() {
    await api.conf.exit();
    for (const k of [QK.confList, QK.confDetail, QK.confGrants, QK.confLog])
      qc.removeQueries({ queryKey: [k] });
    await invalidate(qc, QK.confAccess);
  },
  async confRespond(id, text) {
    qc.setQueryData([QK.confDetail, id], await api.conf.respond(id, text));
    await invalidate(qc, QK.confList);
  },
  async confReveal(id, reason) {
    qc.setQueryData([QK.confDetail, id], await api.conf.reveal(id, reason));
    await invalidate(qc, QK.confLog);
  },
  async confIssueGrant(input) {
    qc.setQueryData([QK.confGrants], (await api.conf.issue(input)).items);
    await invalidate(qc, QK.confLog);
  },
  async confRevoke(id, reason) {
    qc.setQueryData([QK.confGrants], (await api.conf.revoke(id, reason)).items);
    await invalidate(qc, QK.confLog);
  },
});
