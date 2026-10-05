/**
 * Scoring (pure, replaceable). The client's final formula is not confirmed, so the formula lives behind a
 * `ScoringPolicy`: an inspection records which policy scored it, and a new policy can be added without touching
 * the inspection workflow. The demo policy is a weighted compliance percentage.
 */
export type Answer = "c" | "n" | "x" | null;
export interface ScoredItem {
  weight: number;
  answer: Answer;
}
export interface ScoreResult {
  /** `null` when nothing scoreable was answered (all N/A or unanswered) — NOT zero. */
  pct: number | null;
  answered: number;
  total: number;
  compliant: number;
  nonCompliant: number;
  na: number;
}
export interface ScoringPolicy {
  readonly key: string;
  score(items: ScoredItem[]): ScoreResult;
}

/** Σ weight of compliant items ÷ Σ weight of applicable (compliant + non-compliant) items; N/A excluded. */
export const WeightedComplianceV1: ScoringPolicy = {
  key: "weighted_compliance_v1",
  score(items) {
    let num = 0;
    let den = 0;
    let c = 0;
    let n = 0;
    let x = 0;
    for (const it of items) {
      if (!it.answer) continue;
      if (it.answer === "x") {
        x++;
        continue;
      }
      den += it.weight;
      if (it.answer === "c") {
        num += it.weight;
        c++;
      } else n++;
    }
    return { pct: den > 0 ? Math.round((num / den) * 100) : null, answered: c + n + x, total: items.length, compliant: c, nonCompliant: n, na: x };
  },
};

const POLICIES: Record<string, ScoringPolicy> = { [WeightedComplianceV1.key]: WeightedComplianceV1 };
export const DEFAULT_POLICY = WeightedComplianceV1.key;
export function policyFor(key: string): ScoringPolicy {
  const p = POLICIES[key];
  if (!p) throw new Error(`Unknown scoring policy "${key}"`);
  return p;
}

/**
 * Guard evaluation: independent of the site score. Scores are 1–5 per criterion; the guard's result is the mean
 * as a percentage of the maximum, once every criterion is scored.
 */
export function guardScore(scores: Array<number | null>, criteria: number): { done: boolean; pct: number | null; n: number } {
  const given = scores.filter((s): s is number => s != null && s > 0);
  const pct = given.length ? Math.round((given.reduce((a, b) => a + b, 0) / (given.length * 5)) * 100) : null;
  return { done: criteria > 0 && given.length === criteria, pct, n: given.length };
}
