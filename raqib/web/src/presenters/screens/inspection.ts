import type { Inspection, InspectionIssue, InspectionItem, Visit } from "@/api/types";
import { ApiError } from "@/services/http";
import { evidenceKindOf } from "@/services/upload";
import { pickFiles } from "@/services/pick-files";
import { QueuedUpload } from "@/services/offline/outbox";
import { offline } from "@/services/offline/session";
import type { UploadEntry } from "@/state/ui-store";
import { scoreColor, seg, shiftLabel } from "../common";
import type { Ctx } from "../context";
import { openEvidence } from "../viewer";
import { formSwitcher } from "./inspection-forms";
import { C } from "@/styles/colors";

type Target = { visitId: string; inspectionId: string; itemId?: string; guardId?: string };

/** Begin uploading a picked file: it shows progress in the item, then becomes stored evidence (or shows why not). */
function startUpload(c: Ctx, file: File, target: Target, key: string, existingId?: string): void {
  const id = existingId ?? `u${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const kind = evidenceKindOf(file.type);
  const patch = (fn: (e: UploadEntry) => UploadEntry | null) =>
    c.set((s) => ({
      uploads: {
        ...s.uploads,
        [key]: (s.uploads[key] ?? []).flatMap((e) => (e.id === id ? (fn(e) ? [fn(e)!] : []) : [e])),
      },
    }));
  if (!existingId) {
    const entry: UploadEntry = {
      id,
      name: file.name,
      kind,
      size: file.size,
      progress: 0,
      status: "uploading",
      url: kind === "photo" ? URL.createObjectURL(file) : null,
      file,
    };
    c.set((s) => ({ uploads: { ...s.uploads, [key]: [...(s.uploads[key] ?? []), entry] } }));
  } else patch((e) => ({ ...e, status: "uploading", progress: 0 }));
  c.actions
    .uploadEvidence(file, target, (pct) => patch((e) => ({ ...e, progress: pct })))
    .then(() => patch(() => null))
    .catch((err: unknown) => {
      if (err instanceof QueuedUpload)
        return patch((e) => ({ ...e, status: "queued", progress: 0, queueKey: err.blobKey }));
      const limit =
        err instanceof ApiError ? (err.fields as unknown as { limitMb?: number }) : null;
      const rejected =
        err instanceof ApiError &&
        ["raqib.file_too_large", "raqib.file_type_not_allowed"].includes(err.code);
      patch((e) => ({
        ...e,
        status: rejected ? "rejected" : "failed",
        limitMb: (limit as { limitMb?: number } | null)?.limitMb,
      }));
    });
}

const mb = (n: number) => (n / 1_048_576).toFixed(1);

/** Evidence chips for an item or guard: stored files, plus whatever is still uploading or failed. */
function evidenceVM(
  c: Ctx,
  stored: Inspection["sections"][number]["items"][number]["evidence"],
  key: string,
  target: Target,
  canRemove: boolean,
) {
  const { i, ui } = c;
  const done = stored.map((e) => ({
    name: e.name,
    kindLabel:
      e.kind === "video" ? i.S("evVideo") : e.kind === "doc" ? i.S("evDoc") : i.S("evPhoto"),
    meta: `${mb(e.sizeBytes)} MB · ${i.S("ev_done")}`,
    hasUrl: false,
    url: "",
    bgImg: "none",
    busy: false,
    pW: "100%",
    stC: C.text.secondary,
    failed: false,
    canRemove,
    retry: () => undefined,
    isVideo: e.kind === "video",
    remove: () =>
      void c.actions
        .removeEvidence(target.visitId, e.id)
        .catch((err: unknown) =>
          c.toast(err instanceof ApiError ? err.message : i.S("actionFailed")),
        ),
    open: () => openEvidence(c, e, c.data.inspection?.ref ?? ""),
  }));
  const pending = (ui.uploads[key] ?? []).map((u) => ({
    name: u.name,
    kindLabel:
      u.kind === "video" ? i.S("evVideo") : u.kind === "doc" ? i.S("evDoc") : i.S("evPhoto"),
    meta:
      u.status === "uploading"
        ? i.S("ev_uploading", { p: u.progress })
        : u.status === "queued"
          ? i.S("ev_queued")
          : u.status === "rejected"
            ? i.S("ev_rejected", { l: u.limitMb ?? "" })
            : i.S("ev_failed"),
    hasUrl: !!u.url,
    url: u.url ?? "",
    bgImg: u.url ? `url("${u.url}")` : "none",
    busy: u.status === "uploading",
    pW: `${u.progress}%`,
    stC: u.status === "uploading" || u.status === "queued" ? C.status.info.fg : C.status.danger.fg,
    failed: u.status === "failed",
    canRemove: u.status !== "uploading",
    isVideo: u.kind === "video",
    retry: () => u.file && startUpload(c, u.file, target, key, u.id),
    remove: () => {
      if (u.queueKey) void offline.discardBlob(u.queueKey);
      c.set((s) => ({
        uploads: { ...s.uploads, [key]: (s.uploads[key] ?? []).filter((x) => x.id !== u.id) },
      }));
    },
    open: () => undefined,
  }));
  return [...done, ...pending];
}

function issueText(c: Ctx, x: InspectionIssue, guardNames: Map<string, string>): string {
  const { i } = c;
  const map: Record<InspectionIssue["code"], string> = {
    unanswered: "iss_unans",
    note_required: "iss_nonote",
    evidence_required: "iss_noev",
    evidence_pending: "iss_evpend",
    flag_untouched: "iss_flag",
    guard_incomplete: "iss_guard",
  };
  return i.S(map[x.code], {
    n: x.code === "guard_incomplete" ? (guardNames.get(x.at) ?? x.at) : x.at,
  });
}

/** The inspection workspace (design: vmInspect) on the backend's inspection read model. */
export function inspectionWorkspace(c: Ctx, insp: Inspection, visit: Visit | undefined) {
  const { i, ui, set, data } = c;
  // the server refused an answer change (for example, evidence still attached): say why; the screen reverts itself
  const refused = (err: unknown) =>
    c.toast(err instanceof ApiError ? err.message : i.S("actionFailed"));
  const mob = c.mobile;
  const vid = insp.visitId;
  const guardsById = new Map((data.guards ?? []).map((g) => [g.id, g]));
  const guardNames = new Map(
    insp.guards.map((g) => [
      guardsById.get(g.guardId)?.name.en ?? g.guardId,
      i.L(guardsById.get(g.guardId)?.name ?? ""),
    ]),
  );
  const step = Math.min(ui.step, 6);
  const sc = insp.score;
  // a visit may require several forms: they are listed first, the current one highlighted
  const { hasGuardStep, order, switchTo, otherForms, othersReady, formRows } = formSwitcher(
    c,
    insp,
    vid,
  );
  const flaggedSection = (s: Inspection["sections"][number]) => s.items.some((q) => q.flagged);
  const gDone = insp.guards.filter((g) => g.done).length;
  const go = (n: number) => set({ step: n });

  const steps = insp.sections.map((sec, idx) => {
    const a = sec.items.filter((q) => q.answer).length;
    return {
      label: i.L(sec.title),
      meta: `${a}/${sec.items.length}`,
      done: a === sec.items.length,
      i: idx,
      warn: flaggedSection(sec),
    };
  });
  if (hasGuardStep) {
    steps.push({
      label: i.S("guardEval"),
      meta: `${gDone}/${insp.guards.length}`,
      done: gDone === insp.guards.length,
      i: 5,
      warn: false,
    });
  }
  steps.push({ label: i.S("reviewSubmit"), meta: "", done: false, i: 6, warn: false });
  const formVM = formRows;
  const stepVM = [
    ...formVM,
    ...steps.map((x) => ({
      label: x.label,
      meta: x.meta,
      go: () => go(x.i),
      bg: x.i === step ? C.brand.tintAlt : "transparent",
      fg: x.i === step ? C.brand.primaryDark : C.text.ink,
      mark: x.done ? C.status.success.fg : x.warn ? C.status.warning.mark : C.border.input,
      markTxt: x.done ? "✓" : x.warn ? "!" : "",
      cbg: x.i === step ? C.brand.primary : C.surface.white,
      cfg: x.i === step ? C.surface.white : C.text.body,
      cbd: x.i === step ? C.brand.primary : x.warn ? C.status.warning.mark : C.border.input,
    })),
  ];

  const isSec = step < 5;
  const sec = insp.sections[Math.min(step, insp.sections.length - 1)];
  const questions =
    isSec && sec
      ? sec.items.map((q: InspectionItem) => {
          const nc = q.answer === "n";
          const tg: Target = { visitId: vid, inspectionId: insp.id, itemId: q.id };
          const key = q.id;
          const showDetail = nc || !!ui.expanded[key] || !!q.note || q.evidence.length > 0;
          const opt = (val: "c" | "n" | "x", label: string, col: [string, string]) => {
            const on = q.answer === val;
            return {
              label,
              set: q.locked
                ? () => undefined
                : () =>
                    void c.actions.saveAnswer(vid, q.id, { value: on ? null : val }).catch(refused),
              bg: on ? col[1] : C.surface.white,
              fg: on ? col[0] : C.text.body,
              bd: on ? col[0] : C.border.input,
            };
          };
          const opts = [
            opt("c", i.S("ans_c"), [C.status.success.fg, C.status.success.bg]),
            opt("n", i.S("ans_n"), [C.status.danger.fg, C.status.danger.bg]),
          ];
          if (q.na) opts.push(opt("x", i.S("ans_x"), [C.text.graphite, C.surface.sunken]));
          const evs = evidenceVM(c, q.evidence, key, tg, !q.locked);
          const pick = (accept: string, capture: boolean) => () =>
            pickFiles(accept, capture, (files) => files.forEach((f) => startUpload(c, f, tg, key)));
          return {
            num: q.num,
            locked: q.locked,
            canEdit: !q.locked,
            lockTxt: i.S("lockedItem"),
            text: i.L(q.text),
            // weights belong to the scoring rules, which the inspector does not see
            wTxt: c.me.role === "ins" ? "" : i.S("weight", { w: q.weight }),
            border: q.flagged
              ? C.status.warning.borderStrong
              : nc
                ? C.status.danger.border
                : C.border.hairline,
            opts,
            flagged: q.flagged,
            flagMsg: "",
            fixTxt: q.fixed ? i.S("edited") : i.S("notEdited"),
            fixC: q.fixed ? C.status.success.fg : C.status.warning.fg,
            showDetail,
            showAdd: !showDetail,
            expand: () => set((s) => ({ expanded: { ...s.expanded, [key]: true } })),
            isNC: nc,
            noteLabel: nc ? i.S("noteReq") : i.S("noteOpt"),
            note: q.note,
            onNote: (e: { target: { value: string } }) =>
              void c.actions.saveAnswer(vid, q.id, { note: e.target.value }).catch(refused),
            noteErr: nc && !q.note.trim(),
            noteBd: nc && !q.note.trim() ? C.status.danger.borderStrong : C.border.input,
            evLabel: nc ? i.S("evReq") : i.S("evOpt"),
            evErr: nc && q.evidenceOnNc && q.evidence.length === 0,
            ev: evs,
            hasEv: evs.length > 0,
            capture: pick("image/*", true),
            video: pick("video/*", true),
            upload: pick("image/*,video/*,application/pdf", false),
            obsOn: !!ui.obsOn[key],
            toggleObs: () => set((s) => ({ obsOn: { ...s.obsOn, [key]: !s.obsOn[key] } })),
            sevOpts: (["low", "medium", "high"] as const).map((k) =>
              seg(
                q.severity ?? "medium",
                k,
                i.S(`sev_${k}`),
                () => void c.actions.saveAnswer(vid, q.id, { severity: k }).catch(refused),
              ),
            ),
          };
        })
      : [];

  const guards = insp.guards.map((g) => {
    const info = guardsById.get(g.guardId);
    const tg: Target = { visitId: vid, inspectionId: insp.id, guardId: g.guardId };
    const key = `g:${g.guardId}`;
    const evs = evidenceVM(c, g.evidence, key, tg, insp.editable);
    const pick = (accept: string, capture: boolean) => () =>
      pickFiles(accept, capture, (files) => files.forEach((f) => startUpload(c, f, tg, key)));
    return {
      name: info ? i.L(info.name) : g.guardId,
      emp: info?.employeeNo ?? "",
      post: info ? i.L(info.post) : "",
      flag: "",
      hasFlag: false,
      scoreTxt: g.pct == null ? "—" : `${g.pct}%`,
      scoreC: scoreColor(g.pct),
      result: !g.done
        ? i.S("gIncomplete", { n: g.answered })
        : (g.pct ?? 0) >= 80
          ? i.S("g_good")
          : (g.pct ?? 0) >= 60
            ? i.S("g_ok")
            : i.S("g_poor"),
      crit: insp.guardCriteria.map((cr) => ({
        label: i.L(cr.text),
        opts: [1, 2, 3, 4, 5].map((n) => {
          const on = g.scores[cr.id] === n;
          return {
            n: String(n),
            set: () => void c.actions.setGuardScore(vid, g.guardId, cr.id, n),
            bg: on ? C.text.ink : C.surface.white,
            fg: on ? C.surface.white : C.text.body,
            bd: on ? C.text.ink : C.border.input,
          };
        }),
      })),
      note: g.note,
      onNote: (e: { target: { value: string } }) =>
        void c.actions.setGuardNote(vid, g.guardId, e.target.value),
      shift: info ? shiftLabel(c, info.shift) : "",
      proj: visit ? i.L(visit.project.name) : "",
      ev: evs,
      hasEv: evs.length > 0,
      capture: pick("image/*", true),
      upload: pick("image/*,video/*,application/pdf", false),
    };
  });

  const returned = insp.status === "returned";
  const lastReturn = visit?.history.filter((h) => h.action === "returned").pop();
  const iss = insp.issues;
  const ready = !iss.length && othersReady && ui.decl && insp.editable;
  const save = () => {
    c.toast(i.S("toastDraft", { r: insp.ref }));
    c.go("overview");
  };
  return {
    ix: {
      ref: insp.ref,
      title: visit
        ? `${i.L(visit.project.name)} · ${i.L(visit.site.name)}${visit.area == null ? "" : ` · ${i.L(visit.area)}`}`
        : insp.ref,
      formTag: `${insp.form.code} v${insp.form.version}`,
      showScore: sc.visible,
      scoreTxt: sc.pct == null ? "—" : `${sc.pct}%`,
      scoreC: scoreColor(sc.pct),
      progW: `${sc.total ? (sc.answered / sc.total) * 100 : 0}%`,
      progTxt: i.S("answeredOf", { a: sc.answered, n: sc.total }),
      saveTxt: ui.savedAt ? i.S("autosaved", { t: ui.savedAt }) : i.S("draftSaved"),
      saveC: C.text.secondary,
      steps: stepVM,
      cols: mob ? "minmax(0,1fr)" : "248px minmax(0,1fr)",
      isSection: isSec,
      isGuards: step === 5,
      isSubmit: step === 6,
      secTitle: isSec
        ? sec
          ? i.L(sec.title)
          : ""
        : step === 5
          ? i.S("guardEval")
          : i.S("reviewSubmit"),
      secSub: isSec
        ? i.S("sectionOf", { a: step + 1, n: insp.sections.length })
        : step === 5
          ? i.S("guardEvalSub")
          : i.S("submitSub"),
      questions,
      guards,
      hasGuards: guards.length > 0,
      noGuards: guards.length === 0,
      isReturned: returned,
      retReason: lastReturn?.reason ?? "",
      retBy: lastReturn ? i.L(lastReturn.actor.name) : "",
      retCount: i.S("retCount", {
        n: insp.sections.flatMap((s) => s.items).filter((q) => q.flagged || q.fixed).length,
      }),
      prev: () => go(order[Math.max(0, order.indexOf(step) - 1)] ?? 0),
      next: () => go(order[Math.min(order.length - 1, order.indexOf(step) + 1)] ?? 6),
      hasPrev: order.indexOf(step) > 0,
      hasNext: step < 6,
      nextLabel: order[order.indexOf(step) + 1] === 6 ? i.S("toSummary") : i.S("nextSection"),
      saveDraft: save,
      back: () => c.go("visit", vid),
      stats: [
        [i.S("st_answered"), `${sc.answered}/${sc.total}`],
        [i.S("ans_c"), String(sc.compliant)],
        [i.S("ans_n"), String(sc.nonCompliant)],
        [i.S("st_evidence"), String(sc.evidence)],
      ].map(([k, v]) => ({ k, v })),
      issues: [
        ...iss.map((x) => ({ txt: issueText(c, x, guardNames), go: () => go(x.step) })),
        ...otherForms
          .filter((f) => !f.started || f.blocking > 0)
          .map((f) => ({
            txt: f.started
              ? i.S("iss_form", { f: f.code, n: f.blocking })
              : i.S("iss_form_unstarted", { f: f.code }),
            go: () => switchTo(f.formId, f.started),
          })),
      ],
      hasIssues: iss.length > 0 || !othersReady,
      noIssues: iss.length === 0 && othersReady,
      decl: ui.decl,
      onDecl: (e: { target: { checked: boolean } }) => set({ decl: e.target.checked }),
      submitDisabled: !ready,
      submitBg: ready ? C.brand.primary : C.border.stronger,
      submitLabel: returned ? i.S("resubmit") : i.S("submitReview"),
      submit: () => {
        if (ready)
          c.openModal("submit", {
            vid,
            ref: insp.ref,
            summary: i.S(sc.visible ? "m_summary" : "m_summary_noscore", {
              p: sc.pct ?? "—",
              c: sc.compliant,
              n: sc.nonCompliant,
              e: sc.evidence,
            }),
          });
      },
    },
  };
}
