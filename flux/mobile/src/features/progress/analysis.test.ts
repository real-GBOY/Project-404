import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/features/training/catalog";
import { analyzeProgress } from "./analysis";

describe("analyzeProgress", () => {
  it("flags only the plateau demo exercise and reports its gain", () => {
    const bench = analyzeProgress(EXERCISES.bench!, {});
    expect(bench.plateau).toBe(true);
    expect(bench.trend).toBe("Stable");
    expect(analyzeProgress(EXERCISES.squat!, {}).plateau).toBe(false);
  });

  it("uses the stored PR when present, the catalog PR otherwise", () => {
    expect(analyzeProgress(EXERCISES.squat!, { Squat: { kg: 200, date: "x" } }).best).toBe(200);
    expect(analyzeProgress(EXERCISES.squat!, {}).best).toBe(EXERCISES.squat!.prKg);
  });

  it("charts seconds for a hold, with its own unit and best", () => {
    const plank = analyzeProgress(EXERCISES.plankhold!, {});
    expect(plank).toMatchObject({ repsMetric: true, repsUnit: "SEC", current: 60 });
    expect(plank.best).toBeGreaterThanOrEqual(plank.current);
  });
});
