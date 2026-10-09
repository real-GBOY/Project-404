import type { DisplayStatus, Visit } from "@/api/types";
import { printHtml } from "@/services/print-html";
import { saveBlob } from "./reports";
import { TONE, badge, scoreColor, seg, shiftLabel } from "../common";
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
    shift: shiftLabel(c, v.shift),
    date: i.fd(v.date, "d"),
    wd: i.fd(v.date, "wd"),
    time: i.ft(v.time),
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
  const view = (ui.vview as "list" | "week" | "month") || "list";
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
  const canSchedule = me.permissions.visits.includes("A");
  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // the window on screen: a week starting today (moved by whole weeks), or a whole calendar month (moved by months)
  const today0 = new Date(`${me.today}T00:00`);
  const month0 = new Date(
    today0.getFullYear(),
    today0.getMonth() + (view === "month" ? ui.voff : 0),
    1,
  );
  const start = view === "month" ? month0 : new Date(today0.getTime() + ui.voff * 7 * 864e5);
  const monthDays = new Date(month0.getFullYear(), month0.getMonth() + 1, 0).getDate();
  const span = view === "month" ? monthDays : 7;
  // a month is drawn as a calendar: blank cells first so the 1st sits under its weekday (weeks start on Sunday)
  const lead = view === "month" ? month0.getDay() : 0;
  const blanks = Array.from({ length: lead }, () => ({
    iso: "",
    canDrop: false,
    dropVisit: () => undefined,
    wd: "",
    dn: "",
    today: false,
    hbg: "transparent",
    hfg: C.text.ink,
    items: [] as never[],
    empty: false,
    full: "",
  }));
  const days = Array.from({ length: span }, (_, n) => {
    const d = new Date(start.getTime() + n * 864e5);
    const iso = isoOf(d);
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
  const windowEnd = new Date(start.getTime() + (span - 1) * 864e5);
  const windowEndIso = isoOf(windowEnd);
  // what Export / Print cover: the window on screen, or the next twelve months from this month on the list
  const docRange =
    view === "list"
      ? {
          from: isoOf(new Date(today0.getFullYear(), today0.getMonth(), 1)),
          to: isoOf(new Date(today0.getFullYear() + 1, today0.getMonth(), 0)),
        }
      : { from: isoOf(start), to: windowEndIso };
  const canExport = me.permissions.visits.includes("X");
  const canPrint = me.permissions.visits.includes("D");
  const doc = (kind: "export" | "print") => {
    c.toast(i.S("rp_preparing"));
    c.actions
      .scheduleFile(kind, { ...docRange, lang: i.lang })
      .then(async (out) => {
        if (kind === "export") saveBlob(out as Blob, `raqib-schedule-${docRange.from}.csv`);
        else {
          await printHtml(out as string, `raqib-schedule-${docRange.from}`);
          c.toast(i.S("sch_pdfHint"));
        }
      })
      .catch(() => c.toast(i.S("actionFailed")));
  };
  return {
    vl: {
      rows,
      has: !!rows.length,
      none: !rows.length,
      chips,
      count: me.role === "ins" ? i.S("visitsMine") : i.S("visitsAll", { n: vis.length }),
      isList: view === "list",
      isWeek: view === "week" || view === "month",
      weekLabel:
        view === "month"
          ? i.fd(isoOf(month0), "my")
          : `${i.fd(isoOf(start), "d")} – ${i.fd(windowEndIso, "full")}`,
      /** In the month view the blank cells before the 1st make the days line up under their weekdays. */
      days: view === "month" ? [...blanks, ...days] : days,
      daysMobile: view === "month" ? days.filter((d) => d.items.length) : days,
      showNav: view !== "list",
      prev: () => set({ voff: ui.voff - 1 }),
      next: () => set({ voff: ui.voff + 1 }),
      todayGo: () => set({ voff: 0 }),
      navLabels: [i.S("sch_prev"), i.S("sch_today"), i.S("sch_next")],
      canExport,
      canPrint,
      exportCsv: () => doc("export"),
      printSchedule: () => doc("print"),
      views: ["list", "week", "month"].map((k) =>
        seg(view, k, i.S(`view_${k}`), () => set({ vview: k, voff: 0 })),
      ),
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
        [i.S("f_shift"), shiftLabel(c, v.shift)],
        [i.S("f_datetime"), `${i.fd(v.date, "dy")} · ${i.ft(v.time)}`],
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
      blankForms: v.forms.map((f) => ({
        label: i.S("printBlank", { f: f.code }),
        print: () => {
          c.toast(i.S("rp_preparing"));
          c.actions
            .blankFormHtml(f.id, i.lang)
            .then((html) => printHtml(html, `${f.code}-${i.lang}`))
            .catch(() => c.toast(i.S("actionFailed")));
        },
      })),
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
