import { describe, expect, it } from "vitest";
import type { CorrectiveAction, Observation, Report } from "@/api/types";
import { compliance, isOpen, mean, pipeline, shiftDate, weeklyAverages } from "./overview-figures";

const report = (projectId: string, date: string, scorePct: number | null): Report =>
  ({
    id: `${projectId}${date}`,
    projectId,
    scorePct,
    snapshot: { date } as Report["snapshot"],
  }) as Report;
const TODAY = "2026-10-05";

describe("overview figures", () => {
  it("moves dates by whole days across month and year ends", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate(TODAY, 0)).toBe(TODAY);
  });

  it("averages to a whole percent and says nothing for an empty set", () => {
    expect(mean([90, 91])).toBe(91);
    expect(mean([])).toBeNull();
  });

  it("measures the period against the one before it, overall and per project", () => {
    const reports = [
      report("a", "2026-10-01", 90),
      report("a", "2026-09-20", 80),
      report("b", "2026-10-03", 70),
      report("b", "2026-08-01", 50),
    ];
    const c = compliance(reports, TODAY, 30); // 2026-09-06 … 2026-10-05, against 2026-08-07 … 2026-09-05
    expect(c.count).toBe(3);
    expect(c.overall).toBe(80);
    expect(c.previous).toBeNull(); // the 2026-08-01 report is older than the previous window
    expect(c.byProject.get("a")).toEqual({ score: 85, previous: null });
    expect(c.byProject.get("b")).toEqual({ score: 70, previous: null });
  });

  it("ignores reports with no score and counts the edges of the window", () => {
    const c = compliance(
      [report("a", TODAY, null), report("a", "2026-09-29", 88), report("a", "2026-09-28", 10)],
      TODAY,
      7,
    );
    expect(c.count).toBe(2); // the 28th is outside a 7-day window ending the 5th
    expect(c.overall).toBe(88);
  });

  it("gives twelve weekly points ending this week, oldest first", () => {
    const w = weeklyAverages([report("a", TODAY, 90), report("a", "2026-07-20", 70)], TODAY);
    expect(w).toHaveLength(12);
    expect(w.at(-1)).toMatchObject({ avg: 90, n: 1 });
    expect(w.filter((x) => x.avg === 70)).toHaveLength(1);
    expect(w[0]!.from < w[11]!.from).toBe(true);
  });

  it("counts an observation as open until its corrective action is closed", () => {
    const obs = (action: Observation["action"]) => ({ action }) as Observation;
    expect(isOpen(obs(null))).toBe(true);
    expect(isOpen(obs({ status: "in_progress" } as Observation["action"]))).toBe(true);
    expect(isOpen(obs({ status: "closed" } as Observation["action"]))).toBe(false);
  });

  it("puts a late action at the stage it is really in, and counts the late ones", () => {
    const act = (storedStatus: string, status: string) =>
      ({ storedStatus, status }) as CorrectiveAction;
    const p = pipeline([
      act("assigned", "overdue"),
      act("assigned", "assigned"),
      act("quality_review", "quality_review"),
      act("closed", "closed"),
    ]);
    expect(p.find((x) => x.stage === "assigned")).toEqual({ stage: "assigned", n: 2, overdue: 1 });
    expect(p.find((x) => x.stage === "under_review")?.n).toBe(1);
    expect(p.find((x) => x.stage === "closed")?.n).toBe(1);
  });
});
