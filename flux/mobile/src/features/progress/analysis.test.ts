import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/features/training/catalog";
import { seedSessions } from "@/features/training/seed";
import { analyzeProgress } from "./analysis";

const sessions = seedSessions("ppl", new Date("2026-03-04T12:00:00Z"));

describe("analyzeProgress (from sessions)", () => {
  it("flags only the plateau demo exercise (bench)", () => {
    const bench = analyzeProgress(EXERCISES.bench!, {}, sessions);
    expect(bench.plateau).toBe(true);
    expect(bench.trend).toBe("Stable");
    expect(analyzeProgress(EXERCISES.squat!, {}, sessions).plateau).toBe(false);
  });

  it("ends at the catalog baseline and is improving for a normal lift", () => {
    const squat = analyzeProgress(EXERCISES.squat!, {}, sessions);
    expect(squat.current).toBe(EXERCISES.squat!.lastKg);
    expect(squat.trend).toBe("Improving");
    expect(squat.hasHistory).toBe(true);
  });

  it("has no history for an exercise that was never logged", () => {
    const plank = analyzeProgress(EXERCISES.plankhold!, {}, sessions);
    expect(plank.hasHistory).toBe(false);
    expect(plank.data).toEqual([]);
  });

  it("uses the stored PR when present", () => {
    expect(
      analyzeProgress(EXERCISES.squat!, { Squat: { kg: 200, date: "x" } }, sessions).best,
    ).toBe(200);
  });
});
