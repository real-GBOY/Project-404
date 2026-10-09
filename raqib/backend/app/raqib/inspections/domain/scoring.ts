/**
 * Scoring (pure, replaceable). The client's final formula is not confirmed, so the formula lives behind a
 * `ScoringPolicy`: an inspection records which policy scored it, and a new policy can be added without touching
 * the inspection workflow. The demo policy is a weighted compliance percentage.
 */
export type Answer = "c" | "n" | "x" | null;
export type Severity = "low" | "medium" | "high";
export interface ScoredItem {
  weight: number;
  answer: Answer;
  /** Needed by the deduction policy only. */
  id?: string;
  key?: string;
  severity?: Severity | null;
}
export interface ScoreResult {
  /** `null` when nothing scoreable was answered (all N/A or unanswered) — NOT zero. */
  pct: number | null;
  answered: number;
  total: number;
  compliant: number;
  nonCompliant: number;
  na: number;
  /** Deduction policy only: what was taken off, per violation. */
  deductions?: Deduction[];
  /** Deduction policy only: non-compliant items for which no deduction value is configured (they deduct 0). */
  unpriced?: string[];
}
export interface Deduction {
  itemId: string;
  itemKey: string;
  severity: Severity | null;
  amount: number;
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

/** The client's approved deduction rules (a published, immutable `raqib_scoring_configs` version). */
export interface DeductionConfig {
  id: string;
  version: number;
  base: number;
  bySeverity: Partial<Record<Severity, number>>;
  byItem: Record<string, number>;
}

export const DEDUCTION_POLICY = "deduction_v1";

/**
 * Deduction scoring: start from the configured base (100) and take off the configured amount for every
 * non-compliant item. An item-specific amount wins over the severity amount; a violation with no configured amount
 * deducts 0 and is reported in `unpriced` rather than guessed. Each item deducts at most once, however many times
 * it is passed in, and the result never falls below 0. N/A and compliant items never deduct.
 */
export function deductionPolicy(cfg: DeductionConfig): ScoringPolicy {
  return {
    key: DEDUCTION_POLICY,
    score(items) {
      const deductions = new Map<string, Deduction>();
      const unpriced: string[] = [];
      let c = 0;
      let n = 0;
      let x = 0;
      items.forEach((it, i) => {
        if (!it.answer) return;
        if (it.answer === "c") return void c++;
        if (it.answer === "x") return void x++;
        n++;
        const itemId = it.id ?? `#${i}`;
        const itemKey = it.key ?? itemId;
        if (deductions.has(itemId)) return; // one recorded violation, one deduction
        const sev = it.severity ?? null;
        const amount = cfg.byItem[itemKey] ?? (sev ? cfg.bySeverity[sev] : undefined);
        if (amount === undefined) unpriced.push(itemKey);
        deductions.set(itemId, { itemId, itemKey, severity: sev, amount: amount ?? 0 });
      });
      const total = [...deductions.values()].reduce((a, d) => a + d.amount, 0);
      const answered = c + n + x;
      return {
        // nothing scoreable answered (all N/A or nothing yet) is "no score", not a perfect score
        pct: c + n === 0 ? null : Math.max(0, cfg.base - total),
        answered,
        total: items.length,
        compliant: c,
        nonCompliant: n,
        na: x,
        deductions: [...deductions.values()],
        unpriced,
      };
    },
  };
}

const POLICIES: Record<string, ScoringPolicy> = { [WeightedComplianceV1.key]: WeightedComplianceV1 };
export const DEFAULT_POLICY = WeightedComplianceV1.key;
/** `cfg` is the configuration pinned on the inspection; it is required for (and only used by) the deduction policy. */
export function policyFor(key: string, cfg?: DeductionConfig | null): ScoringPolicy {
  if (key === DEDUCTION_POLICY) {
    if (!cfg) throw new Error("The deduction policy needs its configuration");
    return deductionPolicy(cfg);
  }
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

/**
 * A visit with several forms has one result per form; the visit-level figure shown in lists and stored on the report
 * is their mean (assumption pending the client: confirm whether it should be the mean, the lowest, or per-form only).
 */
export function visitScore(pcts: Array<number | null>): number | null {
  const xs = pcts.filter((n): n is number => n != null);
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}
