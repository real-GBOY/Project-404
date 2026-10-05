import type { RoleKey, TemplateChange } from "@/api/types";
import { ApiError } from "@/config";
import type { Ctx } from "./context";
import { ROLE_LABEL } from "./screens/users";

/** Dialogs that need a stated reason (the approved design records who changed what, and why). */
const NEED_REASON = new Set(["create", "resched", "cancel", "roleChange", "userScope", "userDisable", "userEnable", "permSave", "scopeSave", "settingsSave"]);

const ROLES: RoleKey[] = ["qm", "qe", "pm", "ins", "gs", "guard", "gm"];

/** The dialog view-model (design: vmModal + vmModalExt) for the kinds this build supports. */
export function modalVM(c: Ctx) {
  const { i, ui, set } = c;
  const m = ui.modal;
  if (!m) return { hasModal: false, md: {} };
  const f = ui.mf;
  const errs = ui.mErr ?? [];
  const K = m.kind;
  const fld = (k: string) => ({
    val: f[k] == null ? "" : (f[k] as string),
    on: (e: unknown) => {
      const v = e && typeof e === "object" && "target" in e ? (e as { target: { value: string; type: string; checked: boolean } }).target : null;
      const val = v ? (v.type === "checkbox" ? v.checked : v.value) : e;
      set((s) => ({ mf: { ...s.mf, [k]: val }, mErr: null }));
    },
    bd: errs.includes(k) ? "#A3262A" : "#D6D3CB",
    err: errs.includes(k),
  });
  const ref = (m.ref as string | undefined) ?? "";
  const projChecks = (c.data.projects ?? []).map((p) => {
    const cur = (f.projects as string[] | undefined) ?? [];
    return {
      label: `${i.L(p.name)} · ${p.code}`,
      on: cur.includes(p.id),
      toggle: () => set((s) => ({ mf: { ...s.mf, projects: cur.includes(p.id) ? cur.filter((x) => x !== p.id) : cur.concat([p.id]) } })),
    };
  });
  const diff = ((m.diff as Array<{ t: string; c?: string }> | undefined) ?? []).map((d) => ({ t: d.t, c: d.c ?? "#3D4247" }));
  const md = {
    kind: K,
    close: () => set({ modal: null, busy: false }),
    ok: () => void submitModal(c),
    busy: ui.busy,
    cancelLabel: i.S("cancel"),
    title: i.S(`m_${K}_t`, { r: ref }),
    sub: i.S(`m_${K}_s`),
    okLabel: i.S(`m_${K}_ok`),
    okBg: ["userDisable", "cancel"].includes(K) ? "#A3262A" : "#0F5C4A",
    reason: fld("reason"),
    comment: fld("comment"),
    role: fld("role"),
    hasErr: !!errs.length,
    errTxt: i.S("m_err"),
    needReason: NEED_REASON.has(K),
    optComment: false,
    date: fld("date"),
    time: fld("time"),
    ins: fld("ins"),
    p: {
      ...fld("p"),
      on: (e: { target: { value: string } }) => set((st) => ({ mf: { ...st.mf, p: e.target.value, s: "", ins: "" }, mErr: null })),
    },
    s: fld("s"),
    area: fld("area"),
    type: fld("type"),
    shift: fld("shift"),
    isSched: ["resched", "create"].includes(K),
    isCreate: K === "create",
    ...visitOptions(c),
    reasonLabel: K === "create" ? i.S("m_createReason") : i.S("m_reason"),
    reasonPh: i.S(`m_reasonPh_${K}`),
    audit: i.S("m_audit"),
    isRoleSel: ["roleChange"].includes(K),
    roleOpts: [{ v: "", l: i.S("choose") }].concat(ROLES.map((k) => ({ v: k, l: i.L(ROLE_LABEL[k]) }))),
    isProj: ["userScope"].includes(K),
    projChecks,
    isDiff: ["permSave", "scopeSave", "settingsSave"].includes(K) && !!diff.length,
    diff,
  };
  return { hasModal: true, md };
}

/** Select options for the scheduling dialogs. Inspectors are the backend's eligible list for the chosen project. */
function visitOptions(c: Ctx) {
  const { i, ui, data } = c;
  const pid = (ui.mf.p as string | undefined) ?? "";
  const project = (data.projects ?? []).find((p) => p.id === pid);
  const choose = { v: "", l: i.S("choose") };
  return {
    pOpts: [choose].concat((data.projects ?? []).filter((p) => p.sites.length).map((p) => ({ v: p.id, l: i.L(p.name) }))),
    sOpts: [choose].concat((project?.sites ?? []).map((x) => ({ v: x.id, l: i.L(x.name) }))),
    insOpts: [{ v: "", l: i.S("unassigned") }].concat((data.inspectors ?? []).map((x) => ({ v: x.id, l: i.L(x.name) }))),
    typeOpts: ["routine", "surprise", "follow", "night"].map((k) => ({ v: k, l: i.S(`vt_${k}`) })),
    shiftOpts: ["morning", "evening", "night"].map((k) => ({ v: k, l: i.S(`sh_${k}`) })),
  };
}

/** Validate locally (UX), then send the command; the backend remains the authority and may still refuse. */
export async function submitModal(c: Ctx): Promise<void> {
  const { i, ui, set, actions } = c;
  const m = ui.modal;
  if (!m) return;
  const f = ui.mf;
  const reason = String(f.reason ?? "").trim();
  const missing: string[] = [];
  if (NEED_REASON.has(m.kind) && reason.length < 3) missing.push("reason");
  if (m.kind === "create") for (const k of ["p", "s", "date", "time"]) if (!String(f[k] ?? "").trim()) missing.push(k);
  if (m.kind === "resched") for (const k of ["date", "time"]) if (!String(f[k] ?? "").trim()) missing.push(k);
  if (m.kind === "roleChange" && !String(f.role ?? "").trim()) missing.push("role");
  if (missing.length) {
    set({ mErr: missing });
    return;
  }
  set({ busy: true });
  try {
    switch (m.kind) {
      case "create": {
        const v = await actions.createVisit({
          projectId: f.p as string, siteId: f.s as string, areaText: ((f.area as string) || "").trim() || null,
          inspectorId: ((f.ins as string) || "") || null, type: ((f.type as never) || "routine"), shift: ((f.shift as never) || "morning"),
          date: f.date as string, time: f.time as string, reason,
        });
        c.toast(i.S("toastCreated", { r: v.ref }), { label: i.S("open"), fn: () => c.go("visit", v.id) });
        break;
      }
      case "resched":
        await actions.rescheduleVisit(m.vid as string, { date: f.date as string, time: f.time as string, inspectorId: ((f.ins as string) || undefined), reason });
        c.toast(i.S("toastResched", { r: String(m.ref ?? "") }));
        break;
      case "cancel":
        await actions.cancelVisit(m.vid as string, reason);
        c.toast(i.S("toastCancelled", { r: String(m.ref ?? "") }));
        break;
      case "roleChange":
        await actions.changeRole(m.uid as string, f.role as RoleKey, reason);
        c.toast(i.S("toastRole"));
        break;
      case "userScope":
        await actions.setScope(m.uid as string, (f.projects as string[] | undefined) ?? [], reason);
        c.toast(i.S("toastScope"));
        break;
      case "userDisable":
      case "userEnable":
        await actions.setStatus(m.uid as string, m.kind === "userDisable" ? "disabled" : "active", reason);
        c.toast(i.S(m.kind === "userDisable" ? "toastDisabled" : "toastEnabled"));
        break;
      case "permSave": {
        const changes = m.changes as TemplateChange[];
        await actions.applyTemplates(changes, reason);
        set({ permEdit: false, permDraft: null });
        c.toast(i.S("toastPerm", { n: changes.length }));
        break;
      }
      case "scopeSave": {
        const changes = m.scopeChanges as Array<{ userId: string; projectIds: string[] }>;
        for (const ch of changes) await actions.setScope(ch.userId, ch.projectIds, reason);
        set({ scopeEdit: false, scopeDraft: null });
        c.toast(i.S("toastScope"));
        break;
      }
      case "settingsSave":
        await actions.saveSettings(ui.setd as never, reason);
        set({ setd: null });
        c.toast(i.S("toastSettings"));
        break;
    }
    set({ modal: null, busy: false });
  } catch (e) {
    set({ busy: false });
    c.toast(e instanceof ApiError ? e.message : i.S("actionFailed"));
  }
}
