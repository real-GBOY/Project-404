import type { DisplayStatus, Visit } from "@/api/types";
import { TONE, badge, scoreColor, seg } from "../common";
import type { Ctx } from "../context";
import { ROLE_LABEL } from "./users";
import { C } from "@/styles/colors";

/** Status tone per visit status (approved design). */
export const VST: Record<DisplayStatus, string> = {
  scheduled: "neu",
  assigned: "info",
  in_progress: "info",
  pending_review: "rev",
  pending_approval: "rev",
  returned: "warn",
  approved: "ok",
  rejected: "bad",
  cancelled: "neu",
  overdue: "bad",
};

/** Status filter groups of the visit list. */
const GROUPS: Record<string, DisplayStatus[] | null> = {
  all: null,
  upcoming: ["scheduled", "assigned"],
  in_progress: ["in_progress"],
  pending: ["pending_review", "pending_approval"],
  returned: ["returned"],
  overdue: ["overdue"],
  closed: ["approved", "rejected", "cancelled"],
};

const areaOf = (c: Ctx, v: Visit): string => (v.area == null ? "—" : c.i.L(v.area));

/** One visit as a table row / card (design: vRow). Scores arrive with the inspection phases. */
export function visitRow(c: Ctx, v: Visit) {
  const { i } = c;
  return {
    ref: v.ref,
    proj: i.L(v.project.name),
    site: i.L(v.site.name),
    area: areaOf(c, v),
    ins: v.inspector ? i.L(v.inspector.name) : i.S("unassigned"),
    type: i.S(`vt_${v.type}`),
    shift: i.S(`sh_${v.shift}`),
    date: i.fd(v.date, "d"),
    wd: i.fd(v.date, "wd"),
    time: v.time,
    st: badge(i.S(`vs_${v.status}`), VST[v.status]),
    score: v.scorePct == null ? "—" : `${v.scorePct}%`,
    scoreC: scoreColor(v.scorePct),
    go: () => c.go("visit", v.id),
  };
}

/** Start (or continue) the inspection, then open the workspace. The backend snapshots the form on first start. */
export function startInspection(c: Ctx, v: Visit): void {
  const go = () => c.go("inspect", v.id, { step: 0, decl: false });
  if (v.storedStatus === "in_progress" || v.storedStatus === "returned") return go();
  void c.actions
    .startInspection(v.id)
    .then(go)
    .catch((e: unknown) =>
      c.toast(
        e instanceof Error && e.message === "offline"
          ? c.i.S("off_needsConnection")
          : e instanceof Error
            ? e.message
            : c.i.S("actionFailed"),
      ),
    );
}

/** Timeline of a visit's history (design: tl). Actor name, role and title are the snapshots stored with each event. */
export function timeline(c: Ctx, v: Visit) {
  const { i } = c;
  const COLOR: Record<string, string> = {
    scheduled: C.text.muted,
    assigned: C.status.info.fg,
    started: C.status.info.fg,
    submitted: C.status.review.fg,
    resubmitted: C.status.review.fg,
    reviewed: C.status.review.fg,
    returned: C.status.warning.mark,
    rejected: C.status.danger.fg,
    approved: C.status.success.fg,
    rescheduled: C.text.muted,
    cancelled: C.text.muted,
  };
  return v.history.map((h) => ({
    label: i.S(`h_${h.action}`),
    actor: i.L(h.actor.name),
    role: h.actor.role
      ? i.L(ROLE_LABEL[h.actor.role as keyof typeof ROLE_LABEL])
      : i.S("automated"),
    at: i.fd(h.at, "dt"),
    reason: h.reason ?? "",
    hasReason: !!h.reason,
    c: COLOR[h.action] ?? C.text.muted,
  }));
}

/** Visit schedule: list and week views (design: vmVisits). */
export function visitsList(c: Ctx) {
  const { i, ui, set, data, me } = c;
  const vis = data.visits ?? [];
  const view = (ui.vview as "list" | "week") || "list";
  const filter = ui.vfilter in GROUPS ? ui.vfilter : "all";
  const g = GROUPS[filter];
  const rows = vis
    .filter((v) => !g || g.includes(v.status))
    .slice()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((v) => visitRow(c, v));
  const chips = Object.keys(GROUPS).map((k) => {
    const n = GROUPS[k] ? vis.filter((v) => GROUPS[k]!.includes(v.status)).length : vis.length;
    const on = filter === k;
    return {
      label: `${k === "all" ? i.S("all") : i.S(`vg_${k}`)} ${n}`,
      go: () => set({ vfilter: k }),
      bg: on ? C.text.ink : C.surface.white,
      fg: on ? C.surface.white : C.text.body,
      bd: on ? C.text.ink : C.border.input,
    };
  });
  const start = new Date(`${me.today}T00:00`);
  const canSchedule = me.permissions.visits.includes("A");
  const days = Array.from({ length: 7 }, (_, n) => {
    const d = new Date(start.getTime() + n * 864e5);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const items = vis
      .filter((v) => v.date === iso)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((v) => ({
        ...visitRow(c, v),
        bar: TONE[VST[v.status]]![0],
        id: v.id,
        canDrag: canSchedule && MOVABLE.includes(v.storedStatus),
      }));
    const today = iso === me.today;
    return {
      iso,
      canDrop: canSchedule,
      /** A visit was dropped on this day: ask for the reason in the usual reschedule form, prefilled with the new date. */
      dropVisit: (id: string) => moveVisit(c, id, iso),
      wd: i.fd(iso, "wd"),
      dn: i.fd(iso, "dn"),
      today,
      hbg: today ? C.brand.primary : "transparent",
      hfg: today ? C.surface.white : C.text.ink,
      items,
      empty: !items.length,
      full: i.fd(iso, "dy"),
    };
  });
  const weekEnd = new Date(start.getTime() + 6 * 864e5);
  const weekEndIso = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
  return {
    vl: {
      rows,
      has: !!rows.length,
      none: !rows.length,
      chips,
      days,
      count: me.role === "ins" ? i.S("visitsMine") : i.S("visitsAll", { n: vis.length }),
      isList: view === "list",
      isWeek: view === "week",
      weekLabel: `${i.fd(me.today, "d")} – ${i.fd(weekEndIso, "full")}`,
      views: ["list", "week"].map((k) => seg(view, k, i.S(`view_${k}`), () => set({ vview: k }))),
      canSchedule,
      create: () =>
        c.openModal("create", undefined, {
          date: nextDay(me.today, 7),
          time: "09:00",
          type: "routine",
          shift: "morning",
        }),
    },
  };
}

/** Visits whose date can still be changed (the same rule the visit page uses for its Reschedule button). */
const MOVABLE = ["scheduled", "assigned", "in_progress", "returned"];

/** Drag-and-drop on the week grid: open the reschedule form for this visit with the dropped day, keeping time and inspector. */
function moveVisit(c: Ctx, id: string, date: string): void {
  const v = (c.data.visits ?? []).find((x) => x.id === id);
  if (
    !v ||
    v.date === date ||
    !c.me.permissions.visits.includes("A") ||
    !MOVABLE.includes(v.storedStatus)
  )
    return;
  c.openModal(
    "resched",
    { vid: v.id, ref: v.ref },
    { date, time: v.time, ins: v.inspector?.id ?? "", p: v.project.id },
  );
}

function nextDay(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Visit detail (design: vmVisit). Starting, reviewing and reports join with their phases. */
export function visitDetail(c: Ctx, v: Visit) {
  const { i, me, data } = c;
  const guards = new Map((data.guards ?? []).map((g) => [g.id, g]));
  const pend = v.storedStatus === "pending_review" || v.storedStatus === "pending_approval";
  const report = data.reports?.items.find((x) => x.visitId === v.id);
  const changeable = ["scheduled", "assigned", "in_progress", "returned"].includes(v.storedStatus);
  const last = (a: string) => v.history.filter((h) => h.action === a).pop();
  const meta = (a: string): string => {
    const h = last(a);
    return h
      ? i.S("decMeta", {
          d: i.S(`h_${a}`),
          u: i.L(h.actor.name),
          r: h.actor.role ? i.L(ROLE_LABEL[h.actor.role as keyof typeof ROLE_LABEL]) : "",
          t: i.fd(h.at, "dt"),
        })
      : "";
  };
  const g = v.guardIds.map((id) => guards.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return {
    vd: {
      ...visitRow(c, v),
      title: `${i.L(v.site.name)} — ${areaOf(c, v)}`,
      details: [
        [i.S("f_project"), `${i.L(v.project.name)} · ${v.project.code}`],
        [i.S("f_site"), `${i.L(v.site.name)} · ${areaOf(c, v)}`],
        [i.S("f_inspector"), v.inspector ? i.L(v.inspector.name) : i.S("unassigned")],
        [i.S("f_type"), i.S(`vt_${v.type}`)],
        [i.S("f_shift"), i.S(`sh_${v.shift}`)],
        [i.S("f_datetime"), `${i.fd(v.date, "dy")} · ${v.time}`],
      ].map(([k, val]) => ({ k, v: val })),
      guards: g.map((x) => ({
        name: i.L(x.name),
        emp: x.employeeNo,
        post: i.L(x.post),
        score: i.S("notEvaluated"),
        scoreC: scoreColor(null),
      })),
      hasGuards: v.guardIds.length > 0,
      noGuards: v.guardIds.length === 0,
      timeline: timeline(c, v),
      canStart:
        v.inspector?.id === me.id &&
        me.permissions.inspections.includes("S") &&
        ["scheduled", "assigned", "overdue", "in_progress", "returned"].includes(v.status),
      startLabel:
        v.status === "in_progress"
          ? i.S("continueInsp")
          : v.status === "returned"
            ? i.S("openToFix")
            : i.S("startInsp"),
      start: () => startInspection(c, v),
      canManage: me.permissions.visits.includes("A") && changeable,
      resched: () =>
        c.openModal(
          "resched",
          { vid: v.id, ref: v.ref },
          { date: v.date, time: v.time, ins: v.inspector?.id ?? "", p: v.project.id },
        ),
      cancel: () => c.openModal("cancel", { vid: v.id, ref: v.ref }),
      canReview:
        pend &&
        v.inspector?.id !== me.id &&
        ((v.storedStatus === "pending_review" && me.permissions.inspections.includes("R")) ||
          (v.storedStatus === "pending_approval" && me.permissions.inspections.includes("P"))),
      review: () => c.go("review", v.id),
      canSeeResult:
        !!v.inspectionId &&
        v.inspector?.id !== me.id &&
        (me.permissions.inspections.includes("R") || me.permissions.inspections.includes("P")) &&
        !pend,
      result: () => c.go("review", v.id),
      hasReport: !!report,
      report: () => c.go("report", v.id),
      isReturned: v.storedStatus === "returned",
      returnReason: last("returned")?.reason ?? "",
      isRejected: v.storedStatus === "rejected",
      rejectReason: last("rejected")?.reason ?? "",
      isCancelled: v.storedStatus === "cancelled",
      cancelReason: last("cancelled")?.reason ?? "",
      rejectMeta: meta("rejected"),
      returnMeta: meta("returned"),
      cancelMeta: meta("cancelled"),
      hasScore: v.scorePct != null,
      scoreLine:
        v.scorePct == null
          ? ""
          : i.S("scoreLine", { p: v.scorePct, a: "—", n: "—", nc: "—" }).split(" · ")[0]!,
      back: () => c.go(me.role === "ins" ? "overview" : "visits"),
    },
  };
}
