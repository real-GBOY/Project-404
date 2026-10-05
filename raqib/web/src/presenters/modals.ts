import type { RoleKey, TemplateChange } from "@/api/types";
import { ApiError } from "@/config";
import type { Ctx } from "./context";
import { ROLE_LABEL } from "./screens/users";
import { TRAINING_OPTIONS } from "./screens/training";

const { REASONS: TRAINING_REASONS, PROVIDERS: TRAINING_PROVIDERS, RESULTS: TRAINING_RESULTS } = TRAINING_OPTIONS;

/** Dialogs that need a stated reason (the approved design records who changed what, and why). */
const NEED_REASON = new Set(["reveal", "revoke", "grantAdd", "trReturn", "trReject", "caReturn", "return", "reject", "publish", "deactivateForm", "create", "resched", "cancel", "roleChange", "userScope", "userDisable", "userEnable", "permSave", "scopeSave", "settingsSave"]);

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
    okBg: ["userDisable", "cancel", "deactivateForm", "reject", "trReject", "revoke"].includes(K) ? "#A3262A" : ["return", "caReturn", "trReturn"].includes(K) ? "#8A5A00" : "#0F5C4A",
    reason: fld("reason"),
    comment: fld("comment"),
    role: fld("role"),
    hasErr: !!errs.length,
    errTxt: i.S("m_err"),
    needReason: NEED_REASON.has(K),
    optComment: ["forward", "approve", "caClose"].includes(K),
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
    reasonLabel: K === "create" ? i.S("m_createReason") : K === "publish" ? i.S("m_releaseNote") : i.S("m_reason"),
    reasonPh: i.S(`m_reasonPh_${K}`),
    audit: i.S("m_audit"),
    isSubmit: K === "submit",
    isReturn: K === "return",
    isCA: K === "ca",
    isGrantAdd: K === "grantAdd",
    guser: fld("guser"),
    guserOpts: [{ v: "", l: i.S("choose") }].concat((c.data.confGrantees ?? []).map((x) => ({ v: x.id, l: `${i.L(x.name)} · ${i.L(ROLE_LABEL[x.role as keyof typeof ROLE_LABEL])}` }))),
    gscope: fld("gscope"),
    gscopeOpts: (["standard", "all"] as const).map((k) => ({ v: k, l: i.S(`sc_${k}`) })),
    expires: fld("expires"),
    levelOpts: (["view", "respond"] as const).map((k) => ({ label: i.S(`lv_${k}`), set: () => set((s) => ({ mf: { ...s.mf, level: k } })), bg: (f.level ?? "view") === k ? "#191C1F" : "#fff", fg: (f.level ?? "view") === k ? "#fff" : "#191C1F" })),
    isTr: K === "tr",
    isTrSched: K === "trSchedule",
    isTrDone: K === "trComplete",
    g: fld("g"),
    gOpts: [{ v: "", l: i.S("choose") }].concat((c.data.guards ?? []).map((x) => ({ v: x.id, l: `${i.L(x.name)} · ${x.employeeNo}` }))),
    reason2: fld("reason2"),
    reasonOpts: TRAINING_REASONS.map((k) => ({ v: k, l: i.S(`trr_${k}`) })),
    course: fld("course"),
    related: fld("related"),
    notes: fld("notes"),
    priOpts2: (["low", "medium", "high"] as const).map((k) => ({ label: i.S(`pri_${k}`), set: () => set((s) => ({ mf: { ...s.mf, pri: k } })), bg: (f.pri ?? "medium") === k ? "#191C1F" : "#fff", fg: (f.pri ?? "medium") === k ? "#fff" : "#191C1F" })),
    provider: fld("provider"),
    provOpts: TRAINING_PROVIDERS.map((k) => ({ v: k, l: i.S(`prov_${k}`) })),
    resOpts: TRAINING_RESULTS.map((k) => ({ label: i.S(`res_${k}`), set: () => set((s) => ({ mf: { ...s.mf, res: k } })), bg: (f.res ?? "passed") === k ? "#191C1F" : "#fff", fg: (f.res ?? "passed") === k ? "#fff" : "#191C1F" })),
    note2: fld("note"),
    source: String(m.source ?? ""),
    resp: fld("resp"),
    respOpts: [{ v: "", l: i.S("choose") }].concat((c.data.responsibles ?? []).map((x) => ({ v: x.id, l: i.L(x.name) }))),
    due: fld("due"),
    priOpts: (["low", "medium", "high"] as const).map((k) => ({ label: i.S(`pri_${k}`), set: () => set((s) => ({ mf: { ...s.mf, pri: k } })), bg: (f.pri ?? "medium") === k ? "#191C1F" : "#fff", fg: (f.pri ?? "medium") === k ? "#fff" : "#191C1F" })),
    isApprove: K === "approve",
    flags: (m.flags as Array<{ num: string; text: string }> | undefined) ?? [],
    hasFlags: ((m.flags as unknown[] | undefined) ?? []).length > 0,
    noFlags: ((m.flags as unknown[] | undefined) ?? []).length === 0,
    reportRef: `RPT-${String(m.ref ?? "").slice(4)}`,
    isNewSection: K === "newSection",
    title2: fld("title"),
    summary: String(m.summary ?? ""),
    hasAffect: K === "publish",
    affect: K === "publish" ? i.S("pubAffect", { n: Number(m.uses ?? 0), v: String(m.oldV ?? "") }) : "",
    isRoleSel: ["roleChange"].includes(K),
    roleOpts: [{ v: "", l: i.S("choose") }].concat(ROLES.map((k) => ({ v: k, l: i.L(ROLE_LABEL[k]) }))),
    isProj: ["userScope"].includes(K),
    projChecks,
    isDiff: ["permSave", "scopeSave", "settingsSave", "publish"].includes(K) && !!diff.length,
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
  if (m.kind === "ca") for (const k of ["title", "resp", "due"]) if (!String(f[k] ?? "").trim()) missing.push(k);
  if (m.kind === "tr") for (const k of ["g", "course"]) if (!String(f[k] ?? "").trim()) missing.push(k);
  if (m.kind === "trSchedule") for (const k of ["date", "provider"]) if (!String(f[k] ?? "").trim()) missing.push(k);
  if (m.kind === "trComplete" && !String(f.date ?? "").trim()) missing.push("date");
  if (m.kind === "grantAdd") for (const k of ["guser", "expires"]) if (!String(f[k] ?? "").trim()) missing.push(k);
  if (m.kind === "newSection" && !String(f.title ?? "").trim()) missing.push("title");
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
      case "return": {
        const ids = (m.flags as Array<{ id: string }> | undefined)?.map((x) => x.id) ?? [];
        await actions.decideReview(m.vid as string, "return", { reason, itemIds: ids });
        set((st) => ({ rflags: Object.fromEntries(Object.entries(st.rflags).filter(([k]) => !k.startsWith(`${String(m.vid)}:`))) }));
        c.toast(i.S("toastReturned", { r: String(m.ref ?? "") }));
        c.go("reviews", null, { rtab: "returned" });
        break;
      }
      case "reject":
        await actions.decideReview(m.vid as string, "reject", { reason });
        c.toast(i.S("toastRejected", { r: String(m.ref ?? "") }));
        c.go("reviews", null, { rtab: "decided" });
        break;
      case "forward":
        await actions.decideReview(m.vid as string, "forward", { comment: String(f.comment ?? "").trim() || undefined });
        c.toast(i.S("toastForwarded", { r: String(m.ref ?? "") }));
        c.go("reviews", null, { rtab: "pending_approval" });
        break;
      case "approve":
        await actions.decideReview(m.vid as string, "approve", { comment: String(f.comment ?? "").trim() || undefined });
        c.toast(i.S("toastApproved", { r: String(m.ref ?? "") }));
        c.go("visit", m.vid as string);
        break;
      case "ca": {
        const a = await actions.assignAction(m.oid as string, { responsibleId: f.resp as string, dueDate: f.due as string, priority: ((f.pri as never) || "medium"), description: String(f.title).trim() });
        c.toast(i.S("toastCaCreated", { r: a.ref }), { label: i.S("open"), fn: () => c.go("action", a.id) });
        break;
      }
      case "caReturn":
        await actions.actionStep(m.aid as string, "return", { reason });
        c.toast(i.S("toastCaReturned", { r: String(m.ref ?? "") }));
        break;
      case "caClose":
        await actions.actionStep(m.aid as string, "close", { comment: String(f.comment ?? "").trim() || undefined });
        c.toast(i.S("toastCaClosed", { r: String(m.ref ?? "") }));
        break;
      case "tr": {
        const t = await actions.requestTraining({ guardId: f.g as string, reason: ((f.reason2 as never) || "low_score"), course: String(f.course).trim(), related: String(f.related ?? "").trim(), priority: ((f.pri as never) || "medium"), notes: String(f.notes ?? "").trim() });
        c.toast(i.S("toastTrCreated", { r: t.ref }), { label: i.S("open"), fn: () => c.go("trainingD", t.id) });
        break;
      }
      case "trReturn":
        await actions.trainingStep(m.tid as string, "return", { reason });
        c.toast(i.S("toastTrReturned", { r: String(m.ref ?? "") }));
        break;
      case "trReject":
        await actions.trainingStep(m.tid as string, "reject", { reason });
        c.toast(i.S("toastTrRejected", { r: String(m.ref ?? "") }));
        break;
      case "trSchedule":
        await actions.trainingStep(m.tid as string, "schedule", { date: f.date, provider: f.provider });
        c.toast(i.S("toastTrScheduled", { r: String(m.ref ?? "") }));
        break;
      case "trComplete":
        await actions.trainingStep(m.tid as string, "complete", { date: f.date, result: f.res || "passed", note: String(f.note ?? "").trim() || undefined });
        c.toast(i.S("toastTrCompleted", { r: String(m.ref ?? "") }));
        break;
      case "reveal":
        await actions.confReveal(m.rid as string, reason);
        break;
      case "revoke":
        await actions.confRevoke(m.gid as string, reason);
        c.toast(i.S("toastGrantRevoked"));
        break;
      case "grantAdd":
        await actions.confIssueGrant({ userId: f.guser as string, level: ((f.level as never) || "view"), scope: ((f.gscope as never) || "standard"), reason, expiresAt: `${String(f.expires)}T23:59:00Z` });
        c.toast(i.S("toastGrantIssued"));
        break;
      case "submit":
        await actions.submitInspection(m.vid as string);
        c.toast(i.S("toastSubmitted", { r: String(m.ref ?? "") }));
        c.go("visit", m.vid as string);
        break;
      case "publish":
        await actions.publishForm(m.fid as string, reason);
        set({ fb: {}, fbDraft: null });
        c.toast(i.S("toastPublished", { v: String(m.ref ?? "").split(" v")[1] ?? "" }));
        break;
      case "discardDraft":
        await actions.discardDraft(m.fid as string);
        set({ fb: {}, fbDraft: null });
        break;
      case "deactivateForm":
        await actions.setFormActive(m.fid as string, false, reason);
        c.toast(i.S("toastFormOff"));
        break;
      case "newSection": {
        const form = c.data.forms?.items.find((x) => x.id === m.fid);
        const ver = form?.versions.find((v) => v.id === m.vid);
        if (form && ver) {
          const cur = ui.fbDraft && ui.fbDraft.versionId === ver.id ? ui.fbDraft.sections : ver.sections;
          const t = String(f.title);
          await actions.saveDraft(form.id, [...cur, { key: `s${Date.now().toString(36)}`, title: { ar: t, en: t }, items: [] }]);
          set({ fb: { ver: ver.id, sec: cur.length }, fbDraft: null });
        }
        break;
      }
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
