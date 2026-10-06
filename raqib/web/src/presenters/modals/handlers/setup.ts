import type { Severity } from "@/api/types";
import type { ModalHandlers } from "./types";

const text = (v: unknown) => String(v ?? "").trim();

/** Inspection forms, raised observations, people's records and action hand-overs. */
export const setupHandlers: ModalHandlers = {
  async formNew({ c, f }) {
    const { id } = await c.actions.createForm({
      code: text(f.fcode).toUpperCase(),
      category: (text(f.fcat) || "site") as "site" | "guard",
      name: { ar: text(f.nameAr), en: text(f.nameEn) },
    });
    c.go("form", id, { fb: {} });
    c.toast(c.i.S("toastFormNew"));
  },
  async formRename({ c, m, f }) {
    await c.actions.renameForm(String(m.id), { ar: text(f.nameAr), en: text(f.nameEn) });
    c.toast(c.i.S("toastFormRenamed"));
  },
  async obsNew({ c, f }) {
    await c.actions.raiseObservation({
      projectId: text(f.oproj),
      siteId: text(f.osite),
      severity: (text(f.osev) || "medium") as Severity,
      text: text(f.otext),
      ...(text(f.onote) ? { note: text(f.onote) } : {}),
    });
    c.toast(c.i.S("toastObsNew"));
  },
  async userEdit({ c, m, f }) {
    await c.actions.updateProfile(String(m.uid), {
      name: { ar: text(f.nameAr), en: text(f.nameEn) },
      title: { ar: text(f.titleAr), en: text(f.titleEn) },
      phone: text(f.phone) || null,
      employeeNo: text(f.empNo) || null,
    });
    c.toast(c.i.S("toastProfile"));
  },
  async userMfaReset({ c, m, reason }) {
    await c.actions.resetMfa(String(m.uid), reason);
    c.toast(c.i.S("toastMfaReset"));
  },
  async caReassign({ c, m, f, reason }) {
    const resp = text(f.resp);
    const due = text(f.due);
    await c.actions.reassignAction(String(m.aid), {
      ...(resp && resp !== m.curResp ? { responsibleId: resp } : {}),
      ...(due && due !== m.curDue ? { dueDate: due } : {}),
      reason,
    });
    c.toast(c.i.S("toastReassigned"));
  },
};
