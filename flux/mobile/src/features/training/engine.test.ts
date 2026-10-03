import { describe, expect, it } from "vitest";
import { EXERCISES } from "./catalog";
import { computeTarget, isPlateau, platesPerSide, targetFor, trendOf } from "./engine";

const base = {
  repLow: 6,
  repHigh: 8,
  category: "upper" as const,
  daysSinceLast: 2,
  bestSuccessfulKg: 80,
};

describe("computeTarget (double progression)", () => {
  it("raises the weight after hitting the top of the range", () => {
    const t = computeTarget({ ...base, lastKg: 80, lastReps: 8 });
    expect(t).toMatchObject({ kg: 82.5, repLow: 6, repHigh: 8 });
    expect(t.reason).toMatch(/top of your rep range/);
  });

  it("uses the lower-body increment for legs", () => {
    expect(computeTarget({ ...base, category: "lower", lastKg: 140, lastReps: 8 }).kg).toBe(145);
  });

  it("adds a rep when inside the range", () => {
    expect(computeTarget({ ...base, lastKg: 80, lastReps: 7 })).toMatchObject({
      kg: 80,
      repLow: 8,
      repHigh: 8,
    });
  });

  it("repeats when below the range", () => {
    expect(computeTarget({ ...base, lastKg: 80, lastReps: 5 })).toMatchObject({
      kg: 80,
      repLow: 6,
    });
  });

  it("rebuilds from the best successful weight after 14+ days away", () => {
    const t = computeTarget({ ...base, lastKg: 90, lastReps: 8, daysSinceLast: 20 });
    expect(t.kg).toBe(77.5);
    expect(t.reason).toMatch(/time away/);
  });
});

describe("targetFor by tracking type", () => {
  it("adds 5 seconds to a timed hold", () => {
    const t = targetFor(EXERCISES.plankhold!);
    expect(t).toMatchObject({ kg: 0, repLow: 65, repHigh: 65 });
  });

  it("raises the rep range for reps-only lifts at the top", () => {
    const pushup = { ...EXERCISES.pushup!, lastReps: 22 };
    expect(targetFor(pushup)).toMatchObject({ repLow: 22, repHigh: 26 });
  });

  it("reduces assistance once the top of the range is reached", () => {
    const assisted = { ...EXERCISES.asspull!, lastReps: 12, lastKg: 30 };
    expect(targetFor(assisted).kg).toBe(27.5);
  });
});

describe("trend and plateau", () => {
  it("needs four sessions", () => {
    expect(trendOf([70, 72.5, 75])).toBe("Not enough data");
  });

  it("classifies by slope (±1% per session)", () => {
    expect(trendOf([70, 72.5, 75, 77.5, 80])).toBe("Improving");
    expect(trendOf([80, 80, 80, 80])).toBe("Stable");
    expect(trendOf([80, 77.5, 75, 72.5])).toBe("Declining");
  });

  it("flags a plateau only after 3 sub-range sessions without improvement", () => {
    const flat = [80, 80, 80, 80].map((kg) => ({ kg, reps: 6 }));
    expect(isPlateau(flat, 8)).toBe(true);
    expect(isPlateau(flat.slice(0, 2), 8)).toBe(false);
    expect(
      isPlateau(
        flat.map((s) => ({ ...s, reps: 8 })),
        8,
      ),
    ).toBe(false);
  });
});

describe("platesPerSide", () => {
  it("loads the largest plates first on a 20 kg bar", () => {
    expect(platesPerSide(100).plates).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ]);
  });

  it("reports bar only and unloadable remainder", () => {
    expect(platesPerSide(20).plates).toEqual([]);
    expect(platesPerSide(21).remainder).toBeCloseTo(0.5);
  });
});
