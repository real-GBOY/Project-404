import type { ConfAccess, ConfGrant, ConfReport } from "@/api/types";
import { ApiError } from "@/services/http";
import { evidenceKindOf } from "@/services/upload";
import { pickFiles } from "@/services/pick-files";
import { badge } from "../common";
import type { Ctx } from "../context";
import { C } from "@/styles/colors";

const KINDS = ["misconduct", "violation", "safety"] as const;
const MODES = ["named", "confidential", "anonymous"] as const;
const STATUS_TONE = { new: "info", under_review: "warn", closed: "ok" } as const;

const fail = (c: Ctx) => (e: unknown) =>
  c.toast(e instanceof ApiError ? e.message : c.i.S("actionFailed"));

/** The text of a report's status as the reporter and the officer read it. */
function statusBadge(c: Ctx, status: keyof typeof STATUS_TONE, responded: boolean) {
  const key =
    status === "new"
      ? "cfs_received"
      : status === "closed"
        ? "cfs_closed"
        : responded
          ? "cfs_responded"
          : "cfs_investigating";
  return badge(c.i.S(key), STATUS_TONE[status]);
}

function untilText(c: Ctx, access: ConfAccess | undefined): string {
  if (!access?.sessionUntil) return "";
  return c.i.S("cf_session", { t: c.i.fd(access.sessionUntil, "t") });
}

/** Which of the area's four faces this person sees, decided by the backend's view of their grant and session. */
export function confidentialArea(c: Ctx) {
  const { i, ui, set } = c;
  const access = c.data.confAccess;
  const session = !!access?.sessionUntil && Date.parse(access.sessionUntil) > Date.now();
  const hasGrant = !!access?.grant;
  const isGM = !!access?.isGM;
  const gate = !!access && (hasGrant || isGM) && !session;
  const insideOfficer = !!access && hasGrant && session && !(isGM && !hasGrant);
  const insideGM = !!access && isGM && session && !hasGrant;
  const isGuard = !!access && !hasGrant && !isGM;
  const cf = ui.cf;
  const field = (k: string) => ({
    val: String(cf[k] ?? ""),
    on: (e: { target: { value: string } }) =>
      set((s) => ({ cf: { ...s.cf, [k]: e.target.value, err: false } })),
  });
  const grantText = access?.grant
    ? i.S("cf_myGrant", {
        l: i.S(`lv_${access.grant.level}`),
        s: i.S(`sc_${access.grant.scope}`),
        d: i.fd(access.grant.expiresAt, "d"),
      })
    : i.S("cf_gmGrant");
  const kind = (cf.kind as string) || "misconduct";
  const mode = (cf.mode as string) || "confidential";
  const files =
    (cf.files as
      | Array<{
          id: string;
          name: string;
          kind: "photo" | "video" | "doc";
          size: number;
          status: string;
        }>
      | undefined) ?? [];
  const subject = field("subject");
  const body = field("body");
  const place = field("place");

  // ── the reporter ──
  const submit = () => {
    const sj = String(cf.subject ?? "").trim();
    const bd = String(cf.body ?? "").trim();
    if (sj.length < 3 || bd.length < 10) return set((s) => ({ cf: { ...s.cf, err: true } }));
    if (files.some((f) => f.status !== "done")) return c.toast(i.S("ev_uploading", { p: "" }));
    void c.actions
      .confSubmit({
        kind: kind as never,
        subject: sj,
        body: bd,
        place: String(cf.place ?? "").trim(),
        identity: mode as never,
        fileIds: files.map((f) => f.id),
      })
      .then((r) => set({ cf: { done: true, doneRef: r.ref, doneMode: mode } }))
      .catch(fail(c));
  };
  const attach = () =>
    pickFiles("image/*,application/pdf,video/*", false, (picked) =>
      picked.forEach((file) => {
        const id = `f${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
        const entry = {
          id,
          name: file.name,
          kind: evidenceKindOf(file.type),
          size: file.size,
          status: "uploading",
        };
        set((s) => ({ cf: { ...s.cf, files: [...((s.cf.files as unknown[]) ?? []), entry] } }));
        c.actions
          .confUpload(file, () => undefined)
          .then((fileId) =>
            set((s) => ({
              cf: {
                ...s.cf,
                files: ((s.cf.files as Array<{ id: string }>) ?? []).map((f) =>
                  f.id === id ? { ...f, id: fileId, status: "done" } : f,
                ),
              },
            })),
          )
          .catch(() =>
            set((s) => ({
              cf: {
                ...s.cf,
                files: ((s.cf.files as Array<{ id: string }>) ?? []).filter((f) => f.id !== id),
              },
            })),
          );
      }),
    );
  const mine = (c.data.confMine ?? []).map((m) => ({
    ref: m.ref,
    kind: i.S(`cfk_${m.kind}`),
    at: i.fd(m.at, "d"),
    st: statusBadge(c, m.status, !!m.response),
    subject: m.subject,
    hasResp: !!m.response,
    resp: m.response ?? "",
  }));

  // ── the gate ──
  const enter = () => {
    if (!cf.why || !cf.ack) return set((s) => ({ cf: { ...s.cf, gateErr: true } }));
    void c.actions
      .confEnter(String(cf.why), true)
      .then(() => set({ cf: {} }))
      .catch(fail(c));
  };
  const exit = () =>
    void c.actions
      .confExit()
      .then(() => set({ cf: {}, cfSel: "" }))
      .catch(fail(c));

  // ── the officer ──
  const list = c.data.confList ?? [];
  const sel = c.data.confDetail;
  const selId = ui.cfSel;
  const rep = (r: ConfReport) => ({
    go: () => set({ cfSel: r.id, cf: {} }),
    bg: selId === r.id ? C.surface.paperAlt : C.surface.white,
    ref: r.ref,
    kind: i.S(`cfk_${r.kind}`),
    st: statusBadge(c, r.status, false),
    subject: r.subject,
    at: i.fd(r.at, "d"),
    hasSens: r.sensitivity === "high",
    sens: i.S("cf_sensHigh"),
  });
  const selVm = sel
    ? {
        ref: sel.ref,
        st: statusBadge(c, sel.status, !!sel.response),
        kind: i.S(`cfk_${sel.kind}`),
        sens: sel.sensitivity === "high" ? i.S("cf_sensHigh") : i.S("cf_sensStd"),
        at: i.fd(sel.at, "dt"),
        subject: sel.subject,
        isAnon: sel.identity?.mode === "anonymous",
        masked: sel.identity?.mode === "confidential" && !sel.identity.revealed && !!sel.canRespond,
        revealedId: !!sel.identity?.revealed,
        idName: sel.identity?.name ? i.L(sel.identity.name) : "",
        idEmp: sel.identity?.employeeNo ?? "",
        reveal: () => c.openModal("reveal", { rid: sel.id, ref: sel.ref }),
        body: sel.body ?? "",
        files: String(sel.files?.length ?? 0),
        hasResp: !!sel.response,
        response: sel.response ?? "",
        canRespond: !!sel.canRespond && sel.identity?.mode !== undefined,
        comment: String(cf.comment ?? ""),
        onComment: (e: { target: { value: string } }) =>
          set((s) => ({ cf: { ...s.cf, comment: e.target.value } })),
        respond: () => {
          const text = String(cf.comment ?? "").trim();
          if (text.length < 2) return;
          void c.actions
            .confRespond(sel.id, text)
            .then(() => {
              set((s) => ({ cf: { ...s.cf, comment: "" } }));
              c.toast(i.S("responseSent"));
            })
            .catch(fail(c));
        },
        anonNoReply: sel.identity?.mode === "anonymous",
      }
    : null;

  // ── the General Manager ──
  const grants = (c.data.confGrants ?? []).map((g: ConfGrant) => ({
    who: i.L(g.user.name),
    lv: i.S(`lv_${g.level}`),
    scope: i.S(`sc_${g.scope}`),
    by: i.L(g.grantedBy),
    at: i.fd(g.grantedAt, "d"),
    exp: i.S("cf_expires", { d: i.fd(g.expiresAt, "d") }),
    why: g.reason,
    revoked: g.status === "revoked",
    revTxt: g.revokedBy
      ? i.S("cf_revokedBy", { u: i.L(g.revokedBy), r: g.revokeReason ?? "" })
      : "",
    st: badge(
      i.S(`gr_${g.status}`),
      g.status === "active" ? "ok" : g.status === "revoked" ? "bad" : "neu",
    ),
    active: g.status === "active",
    revoke: () => c.openModal("revoke", { gid: g.id, ref: i.L(g.user.name) }),
  }));
  const log = (c.data.confLog ?? []).map((e) => ({
    at: i.fd(e.at, "dt"),
    act: i.S(`cfa_${e.action}`),
    who: i.L(e.actor),
    ref: e.reportRef ?? "",
    why: e.reason ?? "",
    dev: e.device ?? "",
  }));

  return {
    cfx: {
      isGuard,
      done: !!cf.done,
      doneRef: String(cf.doneRef ?? ""),
      doneMsg: cf.doneMode === "anonymous" ? i.S("cf_doneAnon") : i.S("cf_doneMsg"),
      again: () => set({ cf: {} }),
      notDone: !cf.done,
      kinds: KINDS.map((k) => ({
        label: i.S(`cfk_${k}`),
        set: () => set((s) => ({ cf: { ...s.cf, kind: k } })),
        bg: kind === k ? C.text.ink : C.surface.white,
        fg: kind === k ? C.surface.white : C.text.ink,
      })),
      subject: subject.val,
      onSubject: subject.on,
      subjBd:
        cf.err && String(cf.subject ?? "").trim().length < 3 ? C.status.danger.fg : C.border.input,
      body: body.val,
      onBody: body.on,
      bodyBd:
        cf.err && String(cf.body ?? "").trim().length < 10 ? C.status.danger.fg : C.border.input,
      err: !!cf.err,
      place: place.val,
      onPlace: place.on,
      idOpts: MODES.map((m) => ({
        label: i.S(`cfi_${m}`),
        sub: i.S(`cfi_${m}_sub`),
        set: () => set((s) => ({ cf: { ...s.cf, mode: m } })),
        bd: mode === m ? C.brand.primary : C.border.input,
        bg: mode === m ? C.brand.wash : C.surface.white,
        dot: mode === m ? C.brand.primary : "transparent",
      })),
      hasFiles: files.length > 0,
      files: files.map((f) => ({
        kindLabel: i.S(f.kind === "video" ? "evVideo" : f.kind === "doc" ? "evDoc" : "evPhoto"),
        name: f.name,
        stC: f.status === "done" ? C.status.success.fg : C.status.info.fg,
        meta: f.status === "done" ? i.S("ev_done") : i.S("ev_uploading", { p: "" }),
        canRemove: true,
        remove: () => set((s) => ({ cf: { ...s.cf, files: files.filter((x) => x.id !== f.id) } })),
      })),
      attach,
      submit,
      mine,
      gate,
      grant: grantText,
      reasons: (access?.reasons ?? []).map((r) => ({ v: r, l: i.S(`cfr_${r}`) })),
      why: String(cf.why ?? ""),
      onWhy: (e: { target: { value: string } }) =>
        set((s) => ({ cf: { ...s.cf, why: e.target.value, gateErr: false } })),
      ack: !!cf.ack,
      onAck: (e: { target: { checked: boolean } }) =>
        set((s) => ({ cf: { ...s.cf, ack: e.target.checked, gateErr: false } })),
      gateErr: !!cf.gateErr,
      leave: () => c.go("overview"),
      enter,
      isGM: insideGM,
      sessionTxt: untilText(c, access),
      exit,
      addGrant: () =>
        c.openModal("grantAdd", {}, { guser: "", gscope: "standard", level: "view", expires: "" }),
      gmNote: i.S("cf_gmNote"),
      grants,
      fullLog: log,
      access: [],
      insideOfficer,
      myGrant: grantText,
      listCols: c.mobile ? "minmax(0,1fr)" : "minmax(280px,1fr) minmax(0,2fr)",
      list: list.map(rep),
      noSel: !sel,
      hasSel: !!sel,
      sel: selVm ?? {},
    },
  };
}
