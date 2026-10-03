import { describe, expect, it } from "vitest";
import { EXERCISES } from "./catalog";
import { fmtResult, fmtTarget, shapeOf } from "./format";
import { isPlateau, repRange, trendOf } from "./engine";
import { chartsReps, seriesFor } from "../progress/series";

const fmt = { show: (kg: number) => String(kg), short: "kg" };

describe("fmtResult / fmtTarget", () => {
  it("renders each tracking type", () => {
    expect(fmtResult(EXERCISES.bench!, 80, 8, fmt)).toBe("80 kg × 8");
    expect(fmtResult(EXERCISES.pullup!, 5, 8, fmt)).toBe("BW +5 kg × 8");
    expect(fmtResult(EXERCISES.asspull!, 30, 8, fmt)).toBe("−30 kg assist × 8");
    expect(fmtResult(EXERCISES.pushup!, 0, 20, fmt)).toBe("20 reps");
    expect(fmtResult(EXERCISES.plankhold!, 0, 75, fmt)).toBe("1:15");
  });

  it("renders target ranges", () => {
    expect(fmtTarget(EXERCISES.bench!, 82.5, 6, 8, fmt)).toBe("82.5 kg × 6-8");
    expect(fmtTarget(EXERCISES.pushup!, 0, 18, 22, fmt)).toBe("18-22 reps");
    expect(fmtTarget(EXERCISES.plankhold!, 0, 65, 65, fmt)).toBe("1:05");
  });
});

describe("shapeOf", () => {
  it("only weight × reps lifts count as weighted, and timed holds have no load", () => {
    expect(shapeOf(EXERCISES.bench!).weighted).toBe(true);
    expect(shapeOf(EXERCISES.pullup!).weighted).toBe(false);
    expect(shapeOf(EXERCISES.plankhold!)).toMatchObject({ load: false, repsStep: 5 });
  });
});

describe("progress series (demo history)", () => {
  it("has 8 points ending at the current working weight", () => {
    const s = seriesFor(EXERCISES.squat!);
    expect(s).toHaveLength(8);
    expect(s[7]!.v).toBe(EXERCISES.squat!.workKg);
  });

  it("charts reps / seconds for hold and reps-only lifts", () => {
    expect(chartsReps(EXERCISES.plankhold!)).toBe(true);
    expect(seriesFor(EXERCISES.plankhold!)[7]!.v).toBe(EXERCISES.plankhold!.lastReps);
    expect(chartsReps(EXERCISES.bench!)).toBe(false);
  });

  it("makes only the plateau exercise (bench) trigger the plateau banner", () => {
    const flag = (id: string) => {
      const ex = EXERCISES[id]!;
      const s = seriesFor(ex);
      return isPlateau(
        s.map((p) => ({ kg: p.v, reps: p.reps })),
        repRange(ex).high,
      );
    };
    expect(flag("bench")).toBe(true);
    expect(flag("squat")).toBe(false);
    expect(trendOf(seriesFor(EXERCISES.squat!).map((p) => p.v))).toBe("Improving");
  });
});
