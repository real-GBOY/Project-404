import { trackingOf, type Exercise } from "./catalog";

/**
 * The FLUX progression engine (design: flux-demo.jsx + FLUX-DATA-MODEL.md §2–4).
 * Transparent double-progression rules — every target carries a one-line reason.
 */

export type Category = "upper" | "lower";

/** Load increment per category, in kg. */
export const INCREMENT: Record<Category, number> = { upper: 2.5, lower: 5 };

const REP_RANGES: Record<string, [number, number]> = {
  bench: [6, 8],
  ohp: [6, 8],
  deadlift: [3, 5],
  squat: [5, 8],
  row: [6, 8],
  rdl: [6, 8],
  facepull: [12, 15],
  calf: [12, 15],
  fly: [10, 12],
  plank: [12, 15],
  pullup: [6, 10],
  asspull: [8, 12],
  pushup: [18, 22],
};

export const repRange = (ex: Exercise): { low: number; high: number } => {
  const [low, high] = REP_RANGES[ex.id] ?? [8, 12];
  return { low, high };
};

export const categoryOf = (ex: Exercise): Category => (ex.muscle === "Legs" ? "lower" : "upper");

export type Target = { kg: number; repLow: number; repHigh: number; reason: string };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeTarget(input: {
  lastKg: number;
  lastReps: number;
  repLow: number;
  repHigh: number;
  category: Category;
  daysSinceLast: number;
  bestSuccessfulKg: number;
}): Target {
  const inc = INCREMENT[input.category];
  const { repLow, repHigh } = input;
  if (input.daysSinceLast >= 14) {
    return {
      kg: r1(input.bestSuccessfulKg - inc),
      repLow,
      repHigh,
      reason: "Adjusted after time away — rebuilding gradually.",
    };
  }
  if (input.lastReps >= repHigh) {
    return {
      kg: r1(input.lastKg + inc),
      repLow,
      repHigh,
      reason: "You hit the top of your rep range last time.",
    };
  }
  if (input.lastReps >= repLow) {
    return {
      kg: input.lastKg,
      repLow: input.lastReps + 1,
      repHigh,
      reason: "Within range — add a rep before moving up in weight.",
    };
  }
  return {
    kg: input.lastKg,
    repLow,
    repHigh,
    reason: "Below range last time — repeat before progressing.",
  };
}

/** Target for an exercise given how long ago it was last trained. */
export const targetFor = (ex: Exercise, daysSinceLast = 0): Target => {
  const { low, high } = repRange(ex);
  switch (trackingOf(ex)) {
    case "time":
      return {
        kg: 0,
        repLow: ex.lastReps + 5,
        repHigh: ex.lastReps + 5,
        reason: "Add 5 seconds to your last hold.",
      };
    case "reps_only":
      return ex.lastReps >= high
        ? { kg: 0, repLow: high, repHigh: high + 4, reason: "Hit the top — raising the rep range." }
        : {
            kg: 0,
            repLow: ex.lastReps,
            repHigh: high,
            reason: "Add a rep before raising the range.",
          };
    case "assisted_reps":
      return ex.lastReps >= high
        ? {
            kg: Math.max(0, ex.lastKg - 2.5),
            repLow: low,
            repHigh: high,
            reason: "You hit the top of your range — less assistance today.",
          }
        : {
            kg: ex.lastKg,
            repLow: Math.max(low, ex.lastReps + 1),
            repHigh: high,
            reason: "Within range — add a rep before reducing assistance.",
          };
    default:
  }
  return computeTarget({
    lastKg: ex.lastKg,
    lastReps: ex.lastReps,
    repLow: low,
    repHigh: high,
    category: categoryOf(ex),
    daysSinceLast,
    bestSuccessfulKg: ex.workKg,
  });
};

export type Trend = "Improving" | "Stable" | "Declining" | "Not enough data";

/** Linear-regression slope of working weight: ±1 %/session separates the three states. */
export function trendOf(weights: number[]): Trend {
  const w = weights.slice(-6);
  if (w.length < 4) return "Not enough data";
  const n = w.length;
  const xm = (n - 1) / 2;
  const ym = w.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  w.forEach((y, x) => {
    num += (x - xm) * (y - ym);
    den += (x - xm) ** 2;
  });
  const pct = num / (den || 1) / ym;
  if (pct > 0.01) return "Improving";
  if (pct < -0.01) return "Declining";
  return "Stable";
}

/** 3 straight sessions under the top of the rep range while not improving. */
export function isPlateau(sessions: { kg: number; reps: number }[], repHigh: number): boolean {
  const recent = sessions.slice(-3);
  return (
    recent.length === 3 &&
    recent.every((s) => s.reps < repHigh) &&
    trendOf(sessions.map((s) => s.kg)) !== "Improving"
  );
}

/** Greedy plates-per-side for a barbell load (display only). */
export function platesPerSide(
  totalKg: number,
  bar = 20,
  avail = [25, 20, 15, 10, 5, 2.5, 1.25],
): { plates: { plate: number; count: number }[]; remainder: number; bar: number } {
  let side = Math.max(0, (totalKg - bar) / 2);
  const plates: { plate: number; count: number }[] = [];
  for (const p of avail) {
    const count = Math.floor(side / p + 1e-6);
    if (count > 0) {
      plates.push({ plate: p, count });
      side = Math.round((side - count * p) * 100) / 100;
    }
  }
  return { plates, remainder: side, bar };
}

/** Epley estimated one-rep max. */
export const e1rm = (kg: number, reps: number) => kg * (1 + reps / 30);
