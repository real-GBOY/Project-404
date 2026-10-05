import type { ModalHandlers } from "./types";

/** Scheduling: create, reschedule, cancel a visit. */
export const visitHandlers: ModalHandlers = {
  async create({ c, f, reason }) {
    const v = await c.actions.createVisit({
      projectId: f.p as string,
      siteId: f.s as string,
      areaText: ((f.area as string) || "").trim() || null,
      inspectorId: (f.ins as string) || null,
      type: (f.type as never) || "routine",
      shift: (f.shift as never) || "morning",
      date: f.date as string,
      time: f.time as string,
      reason,
    });
    c.toast(c.i.S("toastCreated", { r: v.ref }), {
      label: c.i.S("open"),
      fn: () => c.go("visit", v.id),
    });
  },
  async resched({ c, m, f, reason }) {
    await c.actions.rescheduleVisit(m.vid as string, {
      date: f.date as string,
      time: f.time as string,
      inspectorId: (f.ins as string) || undefined,
      reason,
    });
    c.toast(c.i.S("toastResched", { r: String(m.ref ?? "") }));
  },
  async cancel({ c, m, reason }) {
    await c.actions.cancelVisit(m.vid as string, reason);
    c.toast(c.i.S("toastCancelled", { r: String(m.ref ?? "") }));
  },
};
