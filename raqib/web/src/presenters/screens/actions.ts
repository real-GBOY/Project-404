import type { ActionDisplayStatus, ActionLogEntry, CorrectiveAction, Observation, Severity } from "@/api/types";
import { ApiError } from "@/config";
import { evidenceKindOf } from "@/lib/upload";
import { pickFiles } from "@/lib/pick-files";
import type { UploadEntry } from "@/state/ui-store";
import { TONE, badge } from "../common";
import type { Ctx } from "../context";
import { openEvidence } from "../viewer";
import { ROLE_LABEL } from "./users";

const SEV_TONE: Record<Severity, string> = { low: "neu", medium: "warn", high: "bad" };
const AST_TONE: Record<ActionDisplayStatus, string> = { assigned: "info", in_progress: "info", quality_review: "rev", returned: "warn", closed: "ok", overdue: "bad" };
const STATUS_KEY: Record<ActionDisplayStatus, string> = { assigned: "cs_assigned", in_progress: "cs_in_progress", quality_review: "cs_under_review", returned: "cs_returned", closed: "cs_closed", overdue: "overdue" };

const chip = (label: string, on: boolean, go: () => void) => ({ label, go, bg: on ? "#191C1F" : "#fff", fg: on ? "#fff" : "#3D4247", bd: on ? "#191C1F" : "#D6D3CB" });
const dayDiff = (c: Ctx, iso: string) => c.i.days(c.me.today, iso);

/** "due in 3 days" / "2 days overdue" under the due date. */
function dueSub(c: Ctx, a: { status: ActionDisplayStatus; dueDate: string }): { text: string; color: string } {
  const { i } = c;
  if (a.status === "closed" || a.status === "quality_review") return { text: "", color: "#5C6168" };
  const d = dayDiff(c, a.dueDate);
  if (d < 0) return { text: i.S("daysOverdue", { n: -d }), color: "#A3262A" };
  if (d === 0) return { text: i.S("dueToday"), color: "#8A5A00" };
  return { text: i.S("dueInDays", { n: d }), color: "#5C6168" };
}

const sevBadge = (c: Ctx, s: Severity) => badge(c.i.S(`sev_${s}`), SEV_TONE[s]);
const statusBadge = (c: Ctx, s: ActionDisplayStatus) => badge(c.i.S(STATUS_KEY[s]), AST_TONE[s]);

// ── observations ───────────────────────────────────────────────────────────

const OBS_FILTERS = ["all", "open", "inaction", "closed", "repeat"] as const;

function obsFilter(o: Observation, f: string): boolean {
  if (f === "open") return !o.action;
  if (f === "inaction") return !!o.action && o.action.status !== "closed";
  if (f === "closed") return o.action?.status === "closed";
  if (f === "repeat") return o.repeatCount > 0;
  return true;
}

export function observationsList(c: Ctx) {
  const { i, ui, set, me } = c;
  const all = c.data.observations ?? [];
  const f = (OBS_FILTERS as readonly string[]).includes(ui.ofilter) ? ui.ofilter : "all";
  const canAssign = me.permissions.actions.includes("A");
  const rows = all.filter((o) => obsFilter(o, f)).map((o) => {
    const a = o.action;
    return {
      ref: o.ref,
      kind: badge(i.S(o.kind === "violation" ? "obs_violation" : "obs_observation"), o.kind === "violation" ? "bad" : "info"),
      t: i.L(o.title),
      proj: i.L(o.project.name),
      site: i.L(o.site),
      visit: o.visit?.ref ?? "—",
      item: o.itemNum ?? "—",
      resp: a ? i.L(a.responsible) : i.S("noActionYet"),
      hasRep: o.repeatCount > 0,
      rep: i.S("repeatN", { n: o.repeatCount }),
      sev: sevBadge(c, o.severity),
      due: a ? i.fd(a.dueDate, "d") : "—",
      ca: a?.ref ?? "",
      st: a ? statusBadge(c, a.status) : badge(i.S("obs_open"), "warn"),
      go: () => (a ? c.go("action", a.id) : canAssign ? openAssign(c, o) : undefined),
    };
  });
  return {
    ol: {
      chips: OBS_FILTERS.map((k) => chip(`${i.S(`of_${k}`)} ${all.filter((o) => obsFilter(o, k)).length}`, f === k, () => set({ ofilter: k }))),
      rows,
      has: rows.length > 0,
      none: rows.length === 0,
    },
  };
}

/** Open the "create corrective action" dialog for an observation. */
export function openAssign(c: Ctx, o: Observation): void {
  const due = new Date(`${c.me.today}T00:00`);
  due.setDate(due.getDate() + (o.severity === "high" ? 3 : o.severity === "medium" ? 7 : 14));
  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  c.openModal("ca", { oid: o.id, pid: o.project.id, ref: o.ref, source: `${o.ref} · ${c.i.L(o.title)}` }, { title: "", resp: "", due: iso, pri: o.severity });
}

// ── corrective actions ─────────────────────────────────────────────────────

const ACT_FILTERS = ["all", "mine", "open", "overdue", "review", "closed"] as const;

function actFilter(a: CorrectiveAction, f: string, me: string): boolean {
  if (f === "mine") return a.responsible.id === me && a.status !== "closed";
  if (f === "open") return ["assigned", "in_progress", "returned", "overdue"].includes(a.status);
  if (f === "overdue") return a.status === "overdue";
  if (f === "review") return a.status === "quality_review";
  if (f === "closed") return a.status === "closed";
  return true;
}

export function actionsList(c: Ctx) {
  const { i, ui, set, me } = c;
  const all = c.data.actions ?? [];
  const f = (ACT_FILTERS as readonly string[]).includes(ui.afilter) ? ui.afilter : "all";
  const rank = (a: CorrectiveAction) => ({ overdue: 0, returned: 1, quality_review: 2, assigned: 3, in_progress: 3, closed: 9 })[a.status];
  const rows = all
    .filter((a) => actFilter(a, f, me.id))
    .slice()
    .sort((x, y) => rank(x) - rank(y) || x.dueDate.localeCompare(y.dueDate))
    .map((a) => {
      const sub = dueSub(c, a);
      return {
        ref: a.ref, t: i.L(a.title), proj: i.L(a.project.name), resp: i.L(a.responsible.name),
        hasRep: a.observation.repeatCount > 0, rep: i.S("repeatN", { n: a.observation.repeatCount }),
        pri: badge(i.S(`pri_${a.priority}`), SEV_TONE[a.priority]),
        due: i.fd(a.dueDate, "d"), dueSub: sub.text, dueC: sub.color,
        st: statusBadge(c, a.status),
        go: () => c.go("action", a.id),
      };
    });
  return {
    cl: {
      chips: ACT_FILTERS.map((k) => chip(`${i.S(`af_${k}`)} ${all.filter((a) => actFilter(a, k, me.id)).length}`, f === k, () => set({ afilter: k }))),
      rows,
      has: rows.length > 0,
      none: rows.length === 0,
    },
  };
}

function startUpload(c: Ctx, file: File, actionId: string, key: string, existingId?: string): void {
  const id = existingId ?? `u${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const kind = evidenceKindOf(file.type);
  const patch = (fn: (e: UploadEntry) => UploadEntry | null) =>
    c.set((s) => ({ uploads: { ...s.uploads, [key]: (s.uploads[key] ?? []).flatMap((e) => (e.id === id ? (fn(e) ? [fn(e)!] : []) : [e])) } }));
  if (!existingId) {
    const entry: UploadEntry = { id, name: file.name, kind, size: file.size, progress: 0, status: "uploading", url: kind === "photo" ? URL.createObjectURL(file) : null, file };
    c.set((s) => ({ uploads: { ...s.uploads, [key]: [...(s.uploads[key] ?? []), entry] } }));
  } else patch((e) => ({ ...e, status: "uploading", progress: 0 }));
  c.actions
    .uploadActionEvidence(file, actionId, (pct) => patch((e) => ({ ...e, progress: pct })))
    .then(() => patch(() => null))
    .catch((err: unknown) => {
      const rejected = err instanceof ApiError && ["raqib.file_too_large", "raqib.file_type_not_allowed"].includes(err.code);
      const limit = err instanceof ApiError ? (err.fields as unknown as { limitMb?: number }) : null;
      patch((e) => ({ ...e, status: rejected ? "rejected" : "failed", limitMb: limit?.limitMb }));
    });
}

const mb = (n: number) => (n / 1_048_576).toFixed(1);

export function actionDetail(c: Ctx, a: CorrectiveAction) {
  const { i, ui, set, me } = c;
  const p = me.permissions.actions;
  const isResp = a.responsible.id === me.id;
  const stored = a.storedStatus;
  const log = a.log ?? [];
  const logAt = (k: ActionLogEntry["kind"]) => log.filter((l) => l.kind === k).pop();
  const roleName = (r: string | null) => (r ? i.L(ROLE_LABEL[r as keyof typeof ROLE_LABEL]) : "");
  const canStart = isResp && p.includes("S") && (stored === "assigned" || stored === "returned");
  const canEv = isResp && p.includes("S") && stored === "in_progress";
  const canReview = !isResp && p.includes("R") && stored === "quality_review";
  const key = `action:${a.id}`;
  const evidence = a.evidence ?? [];
  const sub = dueSub(c, a);
  const fail = (e: unknown) => c.toast(e instanceof ApiError ? e.message : i.S("actionFailed"));

  const done = (ok: boolean) => ({ dot: ok ? "#1E6B45" : "#fff", dbd: ok ? "#1E6B45" : "#C9C6BE", line: ok ? "#1E6B45" : "#E3E1DA", mark: ok ? "✓" : "", fg: ok ? "#191C1F" : "#8B9097", fw: "500" });
  const reviewed = logAt("closed") ?? logAt("returned");
  const steps = [
    { label: i.S("as_recorded"), at: a.createdAt, ok: true },
    { label: i.S("as_assigned"), at: log[0]?.at, ok: true },
    { label: i.S("cs_in_progress"), at: logAt("started")?.at, ok: !!logAt("started") },
    { label: i.S("as_evidence"), at: evidence[0]?.at, ok: evidence.length > 0 },
    { label: i.S("as_submitted"), at: logAt("submitted")?.at, ok: !!logAt("submitted") },
    { label: stored === "returned" ? i.S("cs_returned") : i.S("as_decision"), at: reviewed?.at, ok: stored === "closed" || stored === "returned" },
    { label: i.S("cs_closed"), at: a.closedAt ?? undefined, ok: stored === "closed" },
  ];
  const firstPending = steps.findIndex((s) => !s.ok);
  const stepVms = steps.map((s, idx) => {
    const base = done(s.ok);
    const now = idx === firstPending;
    return { ...base, dot: now ? "#fff" : base.dot, dbd: now ? "#0F5C4A" : base.dbd, fw: now ? "600" : base.fw, fg: now ? "#191C1F" : base.fg, label: s.label, sub: s.at ? i.fd(s.at, "dt") : now ? i.S("stg_now") : "" };
  });

  return {
    ad: {
      back: () => c.go("actions"),
      ref: a.ref,
      st: statusBadge(c, a.status),
      pri: badge(i.S(`pri_${a.priority}`), SEV_TONE[a.priority]),
      hasRep: a.observation.repeatCount > 0,
      rep: i.S("repeatN", { n: a.observation.repeatCount }),
      isOverdue: a.status === "overdue",
      overdueTxt: sub.text,
      t: i.L(a.title),
      steps: stepVms,
      stepH: !c.mobile,
      stepVertical: c.mobile,
      isReturned: stored === "returned",
      retReason: logAt("returned")?.text ?? "",
      details: [
        [i.S("f_project"), `${i.L(a.project.name)} · ${a.project.code}`],
        [i.S("f_site"), i.L(a.observation.site)],
        [i.S("f_resp"), i.L(a.responsible.name)],
        [i.S("f_due"), i.fd(a.dueDate, "full")],
        [i.S("f_source"), `${a.observation.ref}${a.observation.itemNum ? ` · ${i.S("item")} ${a.observation.itemNum}` : ""}`],
        [i.S("f_round"), String(a.round)],
        ...(a.description ? [[i.S("caTitle"), a.description]] : []),
      ].map(([k, v]) => ({ k, v })),
      goSource: () => (a.visit ? c.go(me.permissions.inspections.includes("R") || me.permissions.inspections.includes("P") ? "review" : "visit", a.visit.id) : undefined),
      canEv,
      capture: () => pickFiles("image/*", true, (files) => files.forEach((f) => startUpload(c, f, a.id, key))),
      upload: () => pickFiles("image/*,video/*,application/pdf", false, (files) => files.forEach((f) => startUpload(c, f, a.id, key))),
      ev: [
        ...evidence.map((e) => ({
          name: e.name, kindLabel: i.S(e.kind === "video" ? "evVideo" : e.kind === "doc" ? "evDoc" : "evPhoto"), meta: `${mb(e.sizeBytes)} MB · ${i.S("ev_done")}`, stC: "#5C6168",
          hasUrl: false, bgImg: "none", busy: false, pW: "100%", failed: false, canRemove: canEv, retry: () => undefined,
          remove: () => void c.actions.removeActionEvidence(a.id, e.id).catch(fail),
          open: () => openEvidence(c, e, `${a.ref} · ${i.L(a.title)}`),
        })),
        ...(ui.uploads[key] ?? []).map((u) => ({
          name: u.name, kindLabel: i.S(u.kind === "video" ? "evVideo" : u.kind === "doc" ? "evDoc" : "evPhoto"),
          meta: u.status === "uploading" ? i.S("ev_uploading", { p: u.progress }) : u.status === "rejected" ? i.S("ev_rejected", { l: u.limitMb ?? "" }) : i.S("ev_failed"),
          stC: u.status === "uploading" ? "#1F4E8C" : "#A3262A", hasUrl: !!u.url, bgImg: u.url ? `url("${u.url}")` : "none", busy: u.status === "uploading", pW: `${u.progress}%`,
          failed: u.status === "failed", canRemove: u.status !== "uploading", retry: () => u.file && startUpload(c, u.file, a.id, key, u.id),
          remove: () => set((s) => ({ uploads: { ...s.uploads, [key]: (s.uploads[key] ?? []).filter((x) => x.id !== u.id) } })),
          open: () => undefined,
        })),
      ],
      hasEv: evidence.length + (ui.uploads[key] ?? []).length > 0,
      noEv: evidence.length + (ui.uploads[key] ?? []).length === 0 && stored !== "assigned",
      canStart,
      start: () => void c.actions.actionStep(a.id, "start").catch(fail),
      submitEv: () => void c.actions.actionStep(a.id, "submit").then(() => c.toast(i.S("toastCaSubmitted", { r: a.ref }))).catch(fail),
      log: log.map((l) => ({
        ini: i.L(l.actor.name).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(), by: i.L(l.actor.name), role: roleName(l.actor.role), at: i.fd(l.at, "dt"),
        txt: l.kind === "comment" ? (l.text ?? "") : `${i.S(`cl_${l.kind}`)}${l.text ? ` — ${l.text}` : ""}`,
      })),
      comment: String(ui.mf.comment ?? ""),
      onComment: (e: { target: { value: string } }) => set((s) => ({ mf: { ...s.mf, comment: e.target.value } })),
      addComment: () => {
        const text = String(ui.mf.comment ?? "").trim();
        if (!text) return;
        void c.actions.commentAction(a.id, text).then(() => set((s) => ({ mf: { ...s.mf, comment: "" } }))).catch(fail);
      },
      canReview,
      canClose: canReview && p.includes("P"),
      noCloseNote: canReview && !p.includes("P"),
      approve: () => c.openModal("caClose", { aid: a.id, ref: a.ref }),
      ret: () => c.openModal("caReturn", { aid: a.id, ref: a.ref }),
      waiting: !canReview && stored !== "closed" && (stored === "quality_review" || isResp === false),
      waitTxt: stored === "quality_review" ? i.S("waitReview") : i.S("waitResp", { u: i.L(a.responsible.name) }),
      hasDecisions: log.some((l) => l.kind === "returned" || l.kind === "closed"),
      decisions: log
        .filter((l) => l.kind === "returned" || l.kind === "closed")
        .map((l) => ({ c: l.kind === "closed" ? TONE.ok![0] : TONE.warn![0], d: i.S(`cl_${l.kind}`), by: i.L(l.actor.name), role: roleName(l.actor.role), at: i.fd(l.at, "dt"), txt: l.text ?? "" })),
      isClosed: stored === "closed",
    },
  };
}
