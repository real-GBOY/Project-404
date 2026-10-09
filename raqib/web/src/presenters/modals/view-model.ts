import type { RoleKey } from "@/api/types";
import type { Ctx } from "../context";
import { shiftLabel } from "../common";
import { ROLE_LABEL } from "../screens/users";
import { TRAINING_OPTIONS } from "../screens/training";
import { C } from "@/styles/colors";

const {
  REASONS: TRAINING_REASONS,
  PROVIDERS: TRAINING_PROVIDERS,
  RESULTS: TRAINING_RESULTS,
} = TRAINING_OPTIONS;
import { formFields, isFormKind } from "./forms";
import { submitModal } from "./submit";
import { NEED_REASON } from "./validation";

const ROLES: RoleKey[] = ["qm", "qe", "pm", "ins", "gs", "guard", "gm", "adm"];

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
      const v =
        e && typeof e === "object" && "target" in e
          ? (e as { target: { value: string; type: string; checked: boolean } }).target
          : null;
      const val = v ? (v.type === "checkbox" ? v.checked : v.value) : e;
      set((s) => ({ mf: { ...s.mf, [k]: val }, mErr: null }));
    },
    bd: errs.includes(k) ? C.status.danger.fg : C.border.input,
    err: errs.includes(k),
  });
  const ref = (m.ref as string | undefined) ?? "";
  const projChecks = (c.data.projects ?? []).map((p) => {
    const cur = (f.projects as string[] | undefined) ?? [];
    return {
      label: `${i.L(p.name)} · ${p.code}`,
      on: cur.includes(p.id),
      toggle: () =>
        set((s) => ({
          mf: {
            ...s.mf,
            projects: cur.includes(p.id) ? cur.filter((x) => x !== p.id) : cur.concat([p.id]),
          },
        })),
    };
  });
  const formChecks = (c.data.formOptions ?? []).map((fo) => {
    const cur = (f.forms as string[] | undefined) ?? [];
    return {
      label: `${i.L(fo.name)} · ${fo.code} v${fo.version}`,
      on: cur.includes(fo.id),
      toggle: () =>
        set((s) => ({
          mf: {
            ...s.mf,
            forms: cur.includes(fo.id) ? cur.filter((x) => x !== fo.id) : cur.concat([fo.id]),
          },
        })),
    };
  });
  const diff = ((m.diff as Array<{ t: string; c?: string }> | undefined) ?? []).map((d) => ({
    t: d.t,
    c: d.c ?? C.text.body,
  }));
  const md = {
    kind: K,
    close: () => set({ modal: null, busy: false }),
    ok: () => void submitModal(c),
    busy: ui.busy,
    cancelLabel: i.S("cancel"),
    title: i.S(`m_${K}_t`, { r: ref }),
    sub: i.S(`m_${K}_s`),
    okLabel: i.S(`m_${K}_ok`),
    okBg: [
      "userDisable",
      "cancel",
      "deactivateForm",
      "reject",
      "trReject",
      "revoke",
      "reqReject",
      "siteArchive",
      "areaArchive",
      "guardOff",
      "userMfaReset",
    ].includes(K)
      ? C.status.danger.fg
      : ["return", "caReturn", "trReturn"].includes(K)
        ? C.status.warning.fg
        : C.brand.primary,
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
      on: (e: { target: { value: string } }) =>
        set((st) => ({ mf: { ...st.mf, p: e.target.value, s: "", ins: "" }, mErr: null })),
    },
    s: {
      ...fld("s"),
      on: (e: { target: { value: string } }) =>
        set((st) => ({ mf: { ...st.mf, s: e.target.value, areaId: "" }, mErr: null })),
    },
    areaId: fld("areaId"),
    area: fld("area"),
    type: fld("type"),
    shift: fld("shift"),
    isForm: isFormKind(K),
    formFields: isFormKind(K) ? formFields(c, K, fld) : [],
    isSched: ["resched", "create"].includes(K),
    isCreate: K === "create",
    ...visitOptions(c),
    reasonLabel:
      K === "create"
        ? i.S("m_createReason")
        : K === "publish"
          ? i.S("m_releaseNote")
          : i.S("m_reason"),
    reasonPh: i.S(`m_reasonPh_${K}`),
    audit: i.S("m_audit"),
    isSubmit: K === "submit",
    isReturn: K === "return",
    isCA: K === "ca",
    isGrantAdd: K === "grantAdd",
    guser: fld("guser"),
    guserOpts: [{ v: "", l: i.S("choose") }].concat(
      (c.data.confGrantees ?? []).map((x) => ({
        v: x.id,
        l: `${i.L(x.name)} · ${i.L(ROLE_LABEL[x.role as keyof typeof ROLE_LABEL])}`,
      })),
    ),
    gscope: fld("gscope"),
    gscopeOpts: (["standard", "all"] as const).map((k) => ({ v: k, l: i.S(`sc_${k}`) })),
    expires: fld("expires"),
    levelOpts: (["view", "respond"] as const).map((k) => ({
      label: i.S(`lv_${k}`),
      set: () => set((s) => ({ mf: { ...s.mf, level: k } })),
      bg: (f.level ?? "view") === k ? C.text.ink : C.surface.white,
      fg: (f.level ?? "view") === k ? C.surface.white : C.text.ink,
    })),
    isTr: K === "tr",
    isTrSched: K === "trSchedule",
    isTrDone: K === "trComplete",
    g: fld("g"),
    // a guard asks for themselves, so there is no one to pick
    gPick: c.me.role !== "guard",
    gOpts: [{ v: "", l: i.S("choose") }].concat(
      (c.data.guards ?? []).map((x) => ({ v: x.id, l: `${i.L(x.name)} · ${x.employeeNo}` })),
    ),
    reason2: fld("reason2"),
    reasonOpts: TRAINING_REASONS.map((k) => ({ v: k, l: i.S(`trr_${k}`) })),
    course: fld("course"),
    related: fld("related"),
    notes: fld("notes"),
    priOpts2: (["low", "medium", "high"] as const).map((k) => ({
      label: i.S(`pri_${k}`),
      set: () => set((s) => ({ mf: { ...s.mf, pri: k } })),
      bg: (f.pri ?? "medium") === k ? C.text.ink : C.surface.white,
      fg: (f.pri ?? "medium") === k ? C.surface.white : C.text.ink,
    })),
    provider: fld("provider"),
    provOpts: TRAINING_PROVIDERS.map((k) => ({ v: k, l: i.S(`prov_${k}`) })),
    resOpts: TRAINING_RESULTS.map((k) => ({
      label: i.S(`res_${k}`),
      set: () => set((s) => ({ mf: { ...s.mf, res: k } })),
      bg: (f.res ?? "passed") === k ? C.text.ink : C.surface.white,
      fg: (f.res ?? "passed") === k ? C.surface.white : C.text.ink,
    })),
    note2: fld("note"),
    source: String(m.source ?? ""),
    resp: fld("resp"),
    respOpts: [{ v: "", l: i.S("choose") }].concat(
      (c.data.responsibles ?? []).map((x) => ({ v: x.id, l: i.L(x.name) })),
    ),
    due: fld("due"),
    priOpts: (["low", "medium", "high"] as const).map((k) => ({
      label: i.S(`pri_${k}`),
      set: () => set((s) => ({ mf: { ...s.mf, pri: k } })),
      bg: (f.pri ?? "medium") === k ? C.text.ink : C.surface.white,
      fg: (f.pri ?? "medium") === k ? C.surface.white : C.text.ink,
    })),
    isApprove: K === "approve",
    flags: (m.flags as Array<{ num: string; text: string }> | undefined) ?? [],
    hasFlags: ((m.flags as unknown[] | undefined) ?? []).length > 0,
    noFlags: ((m.flags as unknown[] | undefined) ?? []).length === 0,
    reportRef: `RPT-${String(m.ref ?? "").slice(4)}`,
    isNewSection: K === "newSection",
    title2: fld("title"),
    summary: String(m.summary ?? ""),
    hasAffect: K === "publish",
    affect:
      K === "publish" ? i.S("pubAffect", { n: Number(m.uses ?? 0), v: String(m.oldV ?? "") }) : "",
    isRoleSel: ["roleChange", "reqApprove"].includes(K),
    roleOpts: [{ v: "", l: i.S("choose") }].concat(
      (K === "reqApprove" ? (["qe", "pm", "ins", "gs", "guard", "adm"] as RoleKey[]) : ROLES).map(
        (k) => ({
          v: k,
          l: i.L(ROLE_LABEL[k]),
        }),
      ),
    ),
    isProj: ["userScope", "reqApprove"].includes(K),
    projChecks,
    formChecks,
    hasFormChecks: formChecks.length > 1,
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
    pOpts: [choose].concat(
      (data.projects ?? [])
        .filter((p) => p.sites.length && p.status !== "closed")
        .map((p) => ({ v: p.id, l: i.L(p.name) })),
    ),
    sOpts: [choose].concat((project?.sites ?? []).map((x) => ({ v: x.id, l: i.L(x.name) }))),
    areaOpts: [{ v: "", l: i.S("pf_otherArea") }].concat(
      (project?.sites.find((x) => x.id === ui.mf.s)?.areas ?? []).map((a) => ({
        v: a.id,
        l: i.L(a.name),
      })),
    ),
    insOpts: [{ v: "", l: i.S("unassigned") }].concat(
      (data.inspectors ?? []).map((x) => ({ v: x.id, l: i.L(x.name) })),
    ),
    typeOpts: ["routine", "surprise", "follow", "night"].map((k) => ({ v: k, l: i.S(`vt_${k}`) })),
    shiftOpts: (data.shifts?.map((s) => s.key) ?? ["morning", "evening", "night"]).map((k) => ({
      v: k,
      l: shiftLabel({ i, data }, k),
    })),
  };
}
