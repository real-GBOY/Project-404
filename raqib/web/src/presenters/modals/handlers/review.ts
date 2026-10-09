import type { ModalHandlers } from "./types";
import { optional, refOf } from "./types";

/** The review desk: return, reject, forward, approve; and submitting an inspection. */
export const reviewHandlers: ModalHandlers = {
  async return({ c, m, reason }) {
    const ids =
      (m.flagIds as string[] | undefined) ??
      (m.flags as Array<{ id: string }> | undefined)?.map((x) => x.id) ??
      [];
    await c.actions.decideReview(m.vid as string, "return", { reason, itemIds: ids });
    c.set((st) => ({
      rflags: Object.fromEntries(
        Object.entries(st.rflags).filter(([k]) => !k.startsWith(`${String(m.vid)}:`)),
      ),
    }));
    c.toast(c.i.S("toastReturned", { r: refOf(m) }));
    c.go("reviews", null, { rtab: "returned" });
  },
  async reject({ c, m, reason }) {
    await c.actions.decideReview(m.vid as string, "reject", { reason });
    c.toast(c.i.S("toastRejected", { r: refOf(m) }));
    c.go("reviews", null, { rtab: "decided" });
  },
  async forward({ c, m, f }) {
    await c.actions.decideReview(m.vid as string, "forward", { comment: optional(f.comment) });
    c.toast(c.i.S("toastForwarded", { r: refOf(m) }));
    c.go("reviews", null, { rtab: "pending_approval" });
  },
  async approve({ c, m, f }) {
    await c.actions.decideReview(m.vid as string, "approve", { comment: optional(f.comment) });
    c.toast(c.i.S("toastApproved", { r: refOf(m) }));
    c.go("visit", m.vid as string);
  },
  async submit({ c, m }) {
    const r = await c.actions.submitInspection(m.vid as string);
    c.toast(
      r.queued
        ? c.i.S("off_submitQueued", { r: refOf(m) })
        : c.i.S("toastSubmitted", { r: refOf(m) }),
    );
    c.go("visit", m.vid as string);
  },
};
