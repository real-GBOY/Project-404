import type { ModalHandlers } from "./types";

/** The form builder: publish, discard a draft, switch a form off, add a section. */
export const formHandlers: ModalHandlers = {
  async publish({ c, m, reason }) {
    await c.actions.publishForm(m.fid as string, reason);
    c.set({ fb: {}, fbDraft: null });
    c.toast(c.i.S("toastPublished", { v: String(m.ref ?? "").split(" v")[1] ?? "" }));
  },
  async discardDraft({ c, m }) {
    await c.actions.discardDraft(m.fid as string);
    c.set({ fb: {}, fbDraft: null });
  },
  async deactivateForm({ c, m, reason }) {
    await c.actions.setFormActive(m.fid as string, false, reason);
    c.toast(c.i.S("toastFormOff"));
  },
  async newSection({ c, m, f }) {
    const form = c.data.forms?.items.find((x) => x.id === m.fid);
    const ver = form?.versions.find((v) => v.id === m.vid);
    if (!form || !ver) return;
    const draft = c.ui.fbDraft;
    const cur = draft && draft.versionId === ver.id ? draft.sections : ver.sections;
    const title = String(f.title);
    await c.actions.saveDraft(form.id, [
      ...cur,
      { key: `s${Date.now().toString(36)}`, title: { ar: title, en: title }, items: [] },
    ]);
    c.set({ fb: { ver: ver.id, sec: cur.length }, fbDraft: null });
  },
};
