import type { ModalHandlers } from "./types";
import type { RoleKey, TemplateChange } from "@/api/types";

/** Users, permission templates and organization settings. */
export const adminHandlers: ModalHandlers = {
  async roleChange({ c, m, f, reason }) {
    await c.actions.changeRole(m.uid as string, f.role as RoleKey, reason);
    c.toast(c.i.S("toastRole"));
  },
  async userScope({ c, m, f, reason }) {
    await c.actions.setScope(m.uid as string, (f.projects as string[] | undefined) ?? [], reason);
    c.toast(c.i.S("toastScope"));
  },
  async userDisable({ c, m, reason }) {
    await c.actions.setStatus(m.uid as string, "disabled", reason);
    c.toast(c.i.S("toastDisabled"));
  },
  async userEnable({ c, m, reason }) {
    await c.actions.setStatus(m.uid as string, "active", reason);
    c.toast(c.i.S("toastEnabled"));
  },
  async permSave({ c, m, reason }) {
    const changes = m.changes as TemplateChange[];
    await c.actions.applyTemplates(changes, reason);
    c.set({ permEdit: false, permDraft: null });
    c.toast(c.i.S("toastPerm", { n: changes.length }));
  },
  async scopeSave({ c, m, reason }) {
    const changes = m.scopeChanges as Array<{ userId: string; projectIds: string[] }>;
    for (const ch of changes) await c.actions.setScope(ch.userId, ch.projectIds, reason);
    c.set({ scopeEdit: false, scopeDraft: null });
    c.toast(c.i.S("toastScope"));
  },
  async settingsSave({ c, reason }) {
    await c.actions.saveSettings(c.ui.setd as never, reason);
    c.set({ setd: null });
    c.toast(c.i.S("toastSettings"));
  },
};
