import type { ModalHandlers } from "./types";
import { optional, refOf } from "./types";

/** Corrective actions. */
export const qualityHandlers: ModalHandlers = {
  async ca({ c, m, f }) {
    const a = await c.actions.assignAction(m.oid as string, {
      responsibleId: f.resp as string,
      dueDate: f.due as string,
      priority: (f.pri as never) || "medium",
      description: String(f.title).trim(),
    });
    c.toast(c.i.S("toastCaCreated", { r: a.ref }), {
      label: c.i.S("open"),
      fn: () => c.go("action", a.id),
    });
  },
  async caReturn({ c, m, reason }) {
    await c.actions.actionStep(m.aid as string, "return", { reason });
    c.toast(c.i.S("toastCaReturned", { r: refOf(m) }));
  },
  async caClose({ c, m, f }) {
    await c.actions.actionStep(m.aid as string, "close", { comment: optional(f.comment) });
    c.toast(c.i.S("toastCaClosed", { r: refOf(m) }));
  },
};
