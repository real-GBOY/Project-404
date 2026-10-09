import type { AnalyticsContributor, AnalyticsResult, AnalyticsKpi } from "@/api/types";
import { scoreColor } from "../common";
import type { Ctx } from "../context";
import { C } from "@/styles/colors";

export const PERIODS = ["week", "month", "quarter", "year", "custom"] as const;
export type Period = (typeof PERIODS)[number];

/** Filters the analytics screen is currently showing (UI state → backend query). */
export function analyticsQuery(c: Ctx): {
  period: Period;
  from: string;
  to: string;
  projectId: string;
  siteId: string;
  sort: string;
} {
  const { ui } = c;
  return {
    period: (PERIODS as readonly string[]).includes(ui.anPeriod)
      ? (ui.anPeriod as Period)
      : "month",
    from: ui.anFrom,
    to: ui.anTo,
    projectId: ui.anP,
    siteId: ui.anS,
    sort: ui.anRank,
  };
}

const DAY = 86_400_000;
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** A fixed period always has a range; a custom one needs both dates, in order and within the year the backend allows. */
export function analyticsRangeReady(q: { period: string; from: string; to: string }): boolean {
  if (q.period !== "custom") return true;
  if (!q.from || !q.to || q.from > q.to) return false;
  return Date.parse(q.to) - Date.parse(q.from) <= 366 * DAY;
}

const KPI_ORDER = [
  "compliance",
  "inspections",
  "execution",
  "missed",
  "repeats",
  "overdueActions",
  "guardAvg",
] as const;

const pct = (n: number | null): string => (n == null ? "—" : `${n}%`);

function kpiColor(k: AnalyticsKpi): string {
  if (k.value == null) return C.text.muted;
  if (k.key === "compliance" || k.key === "guardAvg" || k.key === "execution")
    return scoreColor(k.value);
  return k.key === "inspections"
    ? C.text.ink
    : k.value > 0
      ? C.status.danger.fg
      : C.status.success.fg;
}

export function analytics(c: Ctx, result: AnalyticsResult | undefined) {
  const { i, ui, set, me } = c;
  const q = analyticsQuery(c);
  const projects = c.data.projects ?? [];
  const project = projects.find((p) => p.id === q.projectId);
  const kpis = result
    ? KPI_ORDER.map((key) => result.kpis.find((k) => k.key === key)).filter(
        (k): k is AnalyticsKpi => !!k,
      )
    : [];
  const dd = kpis.find((k) => k.key === ui.anDd);
  const toRow = (x: AnalyticsContributor) => ({
    ref: x.ref,
    t: typeof x.title === "string" ? x.title : i.L(x.title),
    sub: x.sub,
    val: x.value,
    go: () =>
      c.go(
        x.kind === "report"
          ? "report"
          : x.kind === "visit"
            ? "visit"
            : x.kind === "action"
              ? "action"
              : "observations",
        x.kind === "observation" ? null : x.id,
      ),
  });
  const w = (n: number, max: number) => `${Math.max(2, Math.round((n / (max || 1)) * 100))}%`;
  const maxSec = Math.max(1, ...(result?.sections ?? []).map((s) => s.rate));
  const maxStage = Math.max(1, ...(result?.actionStages ?? []).map((s) => s.n));
  const maxGuard = Math.max(1, ...(result?.guardBuckets ?? []).map((s) => s.n));
  const trendLabel = (l: string) =>
    result?.range.bucket === "month" ? i.fd(`${l}-01`, "my") : i.fd(l, "d");
  const stageColor: Record<string, string> = {
    assigned: C.status.info.fg,
    in_progress: C.status.info.fg,
    quality_review: C.status.review.fg,
    returned: C.status.warning.mark,
    closed: C.status.success.fg,
    overdue: C.status.danger.fg,
  };
  const stageKey: Record<string, string> = {
    assigned: "cs_assigned",
    in_progress: "cs_in_progress",
    quality_review: "cs_under_review",
    returned: "cs_returned",
    closed: "cs_closed",
    overdue: "overdue",
  };
  const field = (k: "anFrom" | "anTo") => ({
    value: ui[k],
    onChange: (e: { target: { value: string } }) => set({ [k]: e.target.value } as never),
  });

  return {
    an: {
      isFixed: false,
      back: () => c.go("overview"),
      canExport: me.permissions.analytics.includes("X"),
      exportCsv: () =>
        void c.actions.exportAnalytics(q, "csv").catch(() => c.toast(i.S("actionFailed"))),
      exportXlsx: () =>
        void c.actions.exportAnalytics(q, "xlsx").catch(() => c.toast(i.S("actionFailed"))),
      range: result ? `${i.fd(result.range.from, "d")} – ${i.fd(result.range.to, "full")}` : "",
      pers: PERIODS.map((k) => ({
        label: i.S(k === "custom" ? "per_custom" : `per_${k === "year" ? "year" : k}`),
        // choosing Custom starts from the last 30 days, so there is a valid range to show before anyone types a date
        set: () =>
          set(
            k === "custom" && !(ui.anFrom && ui.anTo)
              ? {
                  anPeriod: k,
                  anFrom: isoDay(Date.parse(me.today) - 29 * DAY),
                  anTo: me.today,
                }
              : { anPeriod: k },
          ),
        bg: q.period === k ? C.text.ink : C.surface.white,
        fg: q.period === k ? C.surface.white : C.text.body,
      })),
      isCustom: q.period === "custom",
      from: ui.anFrom,
      to: ui.anTo,
      onFrom: field("anFrom").onChange,
      onTo: field("anTo").onChange,
      showProj: projects.length > 1,
      p: q.projectId,
      onP: (e: { target: { value: string } }) => set({ anP: e.target.value, anS: "" }),
      pOpts: [{ v: "", l: i.S("allProjects") }].concat(
        projects.map((p) => ({ v: p.id, l: i.L(p.name) })),
      ),
      rank: q.sort,
      onRank: (e: { target: { value: string } }) => set({ anRank: e.target.value }),
      rankOpts: [
        { v: "", l: i.S("ax_sortAttention") },
        ...["observations", "improvement", "complaints", "contract", "score"].map((k) => ({
          v: k,
          l: i.S(`ax_sort_${k}`),
        })),
      ],
      showSite: !!project,
      s: q.siteId,
      onS: (e: { target: { value: string } }) => set({ anS: e.target.value }),
      sOpts: [{ v: "", l: i.S("allSites") }].concat(
        (project?.sites ?? []).map((s) => ({ v: s.id, l: i.L(s.name) })),
      ),
      kpis: kpis.map((k) => ({
        label: i.S(`kpi_${k.key}`),
        val: k.unit === "pct" ? pct(k.value) : String(k.value ?? 0),
        c: kpiColor(k),
        sub: k.of != null ? i.S("kpi_of", { n: k.of }) : i.S(`kpi_${k.key}_sub`),
        bd: ui.anDd === k.key ? C.brand.primary : C.border.hairline,
        go: () => set({ anDd: ui.anDd === k.key ? "" : k.key }),
      })),
      hasDd: !!dd,
      dd: dd
        ? {
            title: i.S(`kpi_${dd.key}`),
            def: i.S(`kpi_${dd.key}_def`),
            formula: i.S(`kpi_${dd.key}_f`),
            count: i.S("kpi_records", { n: dd.contributors.length }),
            period: `${i.fd(result!.range.from, "d")} – ${i.fd(result!.range.to, "d")}`,
            scope: project ? i.L(project.name) : i.S("allProjects"),
            hasVers: false,
            vers: [],
            list: dd.contributors.slice(0, 50).map(toRow),
            close: () => set({ anDd: "" }),
          }
        : { list: [], vers: [], close: () => undefined },
      trend: (result?.trend ?? []).map((b) => ({
        l: trendLabel(b.label),
        v: b.avg == null ? "—" : String(b.avg),
        h: `${b.avg ?? 0}%`,
        c: b.avg == null ? C.border.strong : scoreColor(b.avg),
        n: b.n,
        miss: b.avg == null,
        go: () => set({ anDd: "compliance" }),
      })),
      secs: (result?.sections ?? []).map((s) => ({
        l: i.L(s.title),
        w: w(s.rate, maxSec),
        n: `${s.rate}%`,
      })),
      siteRows: (result?.sites ?? []).map((s) => ({
        l: i.L(s.site),
        p: i.L(s.project),
        n: s.n,
        w: `${s.avg ?? 0}%`,
        c: scoreColor(s.avg),
        v: pct(s.avg),
      })),
      caStages: (result?.actionStages ?? []).map((s) => ({
        l: i.S(stageKey[s.stage]!),
        w: w(s.n, maxStage),
        c: stageColor[s.stage]!,
        n: s.n,
      })),
      gb: (result?.guardBuckets ?? []).map((b) => ({
        l: i.S(`gb_${b.bucket}`),
        w: w(b.n, maxGuard),
        c:
          b.bucket === "low"
            ? C.status.danger.fg
            : b.bucket === "mid"
              ? C.status.warning.mark
              : C.status.success.fg,
        n: b.n,
      })),
      hasIns: me.permissions.analytics.includes("V") && (result?.inspectors.length ?? 0) > 0,
      insRows: (result?.inspectors ?? []).map((x) => ({
        name: i.L(x.name),
        n: x.done,
        miss: x.missed,
        avg: pct(x.avg),
        ret: x.returned,
      })),
      extra: result
        ? [
            {
              title: i.S("ax_obs"),
              rows: [
                [i.S("ax_obsTotal"), String(result.observationSummary.total)],
                [i.S("ax_high"), String(result.observationSummary.bySeverity.high)],
                [i.S("ax_medium"), String(result.observationSummary.bySeverity.medium)],
                [i.S("ax_low"), String(result.observationSummary.bySeverity.low)],
                [i.S("ax_withAction"), String(result.observationSummary.withAction)],
                [i.S("ax_actionClosed"), String(result.observationSummary.closed)],
              ],
            },
            {
              title: i.S("ax_closure"),
              rows: [
                [i.S("ax_closedN"), String(result.closure.n)],
                [
                  i.S("ax_avgDays"),
                  result.closure.avgDays == null ? "—" : String(result.closure.avgDays),
                ],
                [
                  i.S("ax_maxDays"),
                  result.closure.maxDays == null ? "—" : String(result.closure.maxDays),
                ],
              ],
            },
            {
              title: i.S("ax_recurring"),
              rows: result.recurring.length
                ? result.recurring.map((r) => [`${i.L(r.title)} · ${i.L(r.site)}`, `×${r.times}`])
                : [[i.S("ax_recurringNone"), ""]],
            },
            {
              title: i.S("ax_training"),
              rows: [
                [i.S("ax_trReq"), String(result.training.requested)],
                [i.S("ax_trApproved"), String(result.training.approved)],
                [i.S("ax_trDone"), String(result.training.completed)],
                [i.S("ax_trRejected"), String(result.training.rejected)],
                [i.S("ax_trOpen"), String(result.training.open)],
                [
                  i.S("ax_trDays"),
                  result.training.avgDaysToComplete == null
                    ? "—"
                    : String(result.training.avgDaysToComplete),
                ],
              ],
            },
            {
              title: i.S("ax_ranking"),
              rows: result.ranking.length
                ? result.ranking.map((p) => [
                    `${p.rank}. ${i.L(p.project)}`,
                    [
                      `${pct(p.avg)} · ${p.n}`,
                      `${i.S("ax_rkObs")} ${p.observations}`,
                      `${i.S("ax_rkImp")} ${p.improvement == null ? "—" : p.improvement > 0 ? `+${p.improvement}` : p.improvement}`,
                      // complaint figures are only for holders of a confidential grant
                      ...(p.complaints == null ? [] : [`${i.S("ax_rkCom")} ${p.complaints}`]),
                      `${i.S("ax_rkEnd")} ${p.daysToContractEnd == null ? "—" : p.daysToContractEnd < 0 ? i.S("ax_rkEnded") : i.S("ax_rkDays", { n: p.daysToContractEnd })}`,
                      ...(p.employeesAssigned == null
                        ? []
                        : [`${i.S("ax_rkEmp")} ${p.employeesAssigned}`]),
                    ].join(" · "),
                  ])
                : [[i.S("ax_rankingNone"), ""]],
            },
          ].map((b) => ({ title: b.title, rows: b.rows.map(([k, v]) => ({ k, v })) }))
        : [],
      rep: (result?.repeated ?? []).map((r) => ({
        ref: r.ref,
        t: i.L(r.title),
        sub: i.L(r.site),
        val: `×${r.times}`,
        go: () => c.go("observations"),
      })),
    },
  };
}
