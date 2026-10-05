import { describe, expect, it } from "vitest";
import { bucketFor, computeAnalytics, type AReport, type AnalyticsInput } from "./analytics.js";

const L = (s: string) => ({ ar: s, en: s });
const report = (id: string, date: string, pct: number | null, site = "Gate", guards: Array<number | null> = []): AReport => ({
  id,
  ref: `RPT-${id}`,
  visitId: `v${id}`,
  projectId: "p1",
  scorePct: pct,
  date,
  site: L(site),
  project: L("Park"),
  inspector: L("Ins"),
  formCode: "F",
  sections: [{ title: L("Access"), answered: 4, nonCompliant: pct == null ? 0 : pct < 80 ? 2 : 0 }],
  guards: guards.map((p, n) => ({ employeeNo: `G${n}`, pct: p })),
  returns: 0,
});

const base = (over: Partial<AnalyticsInput> = {}): AnalyticsInput => ({
  from: "2026-09-01",
  to: "2026-09-30",
  today: "2026-10-04",
  reports: [],
  visits: [],
  observations: [],
  actions: [],
  inspectors: new Map(),
  ...over,
});

describe("analytics", () => {
  it("averages only issued, scored reports inside the range", () => {
    const r = computeAnalytics(
      base({ reports: [report("1", "2026-09-05", 90), report("2", "2026-09-10", 70), report("3", "2026-08-01", 10), report("4", "2026-09-12", null)] }),
    );
    const k = Object.fromEntries(r.kpis.map((x) => [x.key, x]));
    expect(k.compliance!.value).toBe(80);
    expect(k.inspections!.value).toBe(3);
    expect(k.compliance!.contributors.map((c) => c.ref)).toEqual(["RPT-1", "RPT-2"]);
  });

  it("derives execution and missed visits from the visits themselves", () => {
    const visits = [
      { id: "a", ref: "VIS-1", projectId: "p1", inspectorId: "u1", date: "2026-09-03", status: "approved" },
      { id: "b", ref: "VIS-2", projectId: "p1", inspectorId: "u1", date: "2026-09-04", status: "scheduled" },
      { id: "c", ref: "VIS-3", projectId: "p1", inspectorId: "u1", date: "2026-09-05", status: "cancelled" },
      { id: "d", ref: "VIS-4", projectId: "p1", inspectorId: "u1", date: "2026-09-06", status: "in_progress" },
    ];
    const r = computeAnalytics(base({ visits, inspectors: new Map([["u1", L("Khalid")]]) }));
    const k = Object.fromEntries(r.kpis.map((x) => [x.key, x]));
    expect(k.execution!.value).toBe(67); // 2 of 3 non-cancelled
    expect(k.execution!.of).toBe(3);
    expect(k.missed!.value).toBe(1);
    expect(r.inspectors[0]).toMatchObject({ done: 0, missed: 1 });
  });

  it("buckets the trend by day, week or month depending on the range", () => {
    expect(bucketFor("2026-09-01", "2026-09-30")).toBe("day");
    expect(bucketFor("2026-07-01", "2026-09-30")).toBe("week");
    expect(bucketFor("2025-10-01", "2026-09-30")).toBe("month");
    const r = computeAnalytics(base({ reports: [report("1", "2026-09-05", 90), report("2", "2026-09-05", 70)] }));
    expect(r.trend).toEqual([{ label: "2026-09-05", avg: 80, n: 2 }]);
  });

  it("ranks sites worst first and sections by non-compliance rate", () => {
    const r = computeAnalytics(base({ reports: [report("1", "2026-09-05", 95, "Tower"), report("2", "2026-09-06", 60, "Gate")] }));
    expect(r.sites.map((s) => s.site.en)).toEqual(["Gate", "Tower"]);
    expect(r.sections[0]).toMatchObject({ rate: 25, nonCompliant: 2, answered: 8 });
  });

  it("buckets guard scores and stages actions, with overdue derived from the due date", () => {
    const r = computeAnalytics(
      base({
        reports: [report("1", "2026-09-05", 90, "Gate", [50, 70, 95, null])],
        actions: [
          { id: "x", ref: "CA-1", projectId: "p1", title: L("t"), status: "in_progress", dueDate: "2026-10-01" },
          { id: "y", ref: "CA-2", projectId: "p1", title: L("t"), status: "closed", dueDate: "2026-09-01" },
          { id: "z", ref: "CA-3", projectId: "p1", title: L("t"), status: "quality_review", dueDate: "2026-09-01" },
        ],
      }),
    );
    expect(r.guardBuckets).toEqual([
      { bucket: "low", n: 1 },
      { bucket: "mid", n: 1 },
      { bucket: "high", n: 1 },
    ]);
    const stage = (s: string) => r.actionStages.find((x) => x.stage === s)!.n;
    expect(stage("overdue")).toBe(1);
    expect(stage("in_progress")).toBe(0);
    expect(stage("closed")).toBe(1);
    expect(stage("quality_review")).toBe(1);
  });

  it("is empty-safe", () => {
    const r = computeAnalytics(base());
    expect(r.kpis.find((k) => k.key === "compliance")!.value).toBeNull();
    expect(r.trend).toEqual([]);
  });
});
