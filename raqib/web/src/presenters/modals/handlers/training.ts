import type { ModalHandlers } from "./types";
import { optional, refOf } from "./types";

/** Guard training requests. */
export const trainingHandlers: ModalHandlers = {
  async tr({ c, f }) {
    const t = await c.actions.requestTraining({
      // a guard asks for themselves: the server uses their own record
      guardId: f.g === "self" ? undefined : (f.g as string),
      reason: (f.reason2 as never) || "low_score",
      course: String(f.course).trim(),
      related: String(f.related ?? "").trim(),
      priority: (f.pri as never) || "medium",
      notes: String(f.notes ?? "").trim(),
    });
    c.toast(c.i.S("toastTrCreated", { r: t.ref }), {
      label: c.i.S("open"),
      fn: () => c.go("trainingD", t.id),
    });
  },
  async trReturn({ c, m, reason }) {
    await c.actions.trainingStep(m.tid as string, "return", { reason });
    c.toast(c.i.S("toastTrReturned", { r: refOf(m) }));
  },
  async trReject({ c, m, reason }) {
    await c.actions.trainingStep(m.tid as string, "reject", { reason });
    c.toast(c.i.S("toastTrRejected", { r: refOf(m) }));
  },
  async trSchedule({ c, m, f }) {
    await c.actions.trainingStep(m.tid as string, "schedule", {
      date: f.date,
      provider: f.provider,
    });
    c.toast(c.i.S("toastTrScheduled", { r: refOf(m) }));
  },
  async trComplete({ c, m, f }) {
    await c.actions.trainingStep(m.tid as string, "complete", {
      date: f.date,
      result: f.res || "passed",
      note: optional(f.note),
    });
    c.toast(c.i.S("toastTrCompleted", { r: refOf(m) }));
  },
};
