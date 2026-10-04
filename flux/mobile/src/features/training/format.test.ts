import { describe, expect, it } from "vitest";
import { EXERCISES } from "./catalog";
import { fmtResult, fmtTarget, shapeOf } from "./format";

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
