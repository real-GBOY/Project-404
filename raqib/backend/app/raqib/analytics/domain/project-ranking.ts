import type { L10n } from "@raqib/raqib/shared/l10n.js";

/**
 * Project ranking on the four indicators the client named: number of observations, performance improvement, complaints and
 * proximity to contract expiration. Pure: the service gathers the facts, this ranks them.
 *
 * The default order is "needs attention first": each indicator gives a project a percentile among the projects (0 = best,
 * 1 = worst) and the weighted mean of those is its attention score. The weights are the organization\'s settings (equal until the
 * client chooses). Any single indicator can be used on its own instead.
 */
export type RankSort = "attention" | "observations" | "improvement" | "complaints" | "contract" | "score";
export interface RankWeights {
  observations: number;
  improvement: number;
  complaints: number;
  contract: number;
}
export interface RankFacts {
  projectId: string;
  project: L10n;
  /** Average score of the project\'s issued reports in the range, and how many reports. */
  avg: number | null;
  n: number;
  /** Observations recorded in the range. */
  observations: number;
  /** Average score of the later half of the range minus the earlier half; null when either half has no scored report. */
  improvement: number | null;
  /** Complaints linked to the project. `null` when the caller may not see complaint figures (no confidential grant). */
  complaints: number | null;
  contractEnd: string | null;
  employeesAssigned: number | null;
  /** Days from today to the contract end: negative once it has ended, null without contract dates. */
  daysToContractEnd: number | null;
}
export interface RankedProject extends RankFacts {
  rank: number;
  /** 0 (no concern) to 100 (most concern); null when `attention` is not what the list is ordered by and nothing was weighted. */
  attention: number;
}

/** Percentile of each value among the defined ones: 0 for the best, 1 for the worst; undefined values contribute 0. */
function percentiles(values: Array<number | null>, worstIsHigh: boolean): number[] {
  const defined = values.filter((v): v is number => v != null);
  const distinct = [...new Set(defined)].sort((a, b) => (worstIsHigh ? a - b : b - a)); // best first
  if (distinct.length <= 1) return values.map(() => 0);
  return values.map((v) => (v == null ? 0 : distinct.indexOf(v) / (distinct.length - 1)));
}

export function rankProjects(facts: RankFacts[], sort: RankSort, weights: RankWeights): RankedProject[] {
  const obs = percentiles(
    facts.map((f) => f.observations),
    true,
  );
  const imp = percentiles(
    facts.map((f) => f.improvement),
    false,
  ); // less improvement is worse
  const com = percentiles(
    facts.map((f) => f.complaints),
    true,
  );
  const con = percentiles(
    facts.map((f) => f.daysToContractEnd),
    false,
  ); // the sooner it ends the more it matters
  const total = weights.observations + weights.improvement + weights.complaints + weights.contract;
  const scored = facts.map((f, i) => ({
    ...f,
    attention:
      total > 0
        ? Math.round(
            ((obs[i]! * weights.observations + imp[i]! * weights.improvement + com[i]! * weights.complaints + con[i]! * weights.contract) / total) * 100,
          )
        : 0,
  }));
  const nullsLast = (a: number | null, b: number | null, desc: boolean): number => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return desc ? b - a : a - b;
  };
  const byName = (a: RankFacts, b: RankFacts): number => a.project.en.localeCompare(b.project.en);
  scored.sort((a, b) => {
    switch (sort) {
      case "observations":
        return b.observations - a.observations || byName(a, b);
      case "improvement":
        return nullsLast(a.improvement, b.improvement, false) || byName(a, b); // least improved first
      case "complaints":
        return nullsLast(a.complaints, b.complaints, true) || byName(a, b);
      case "contract":
        return nullsLast(a.daysToContractEnd, b.daysToContractEnd, false) || byName(a, b); // soonest end first
      case "score":
        return nullsLast(a.avg, b.avg, true) || b.n - a.n || byName(a, b); // best score first
      default:
        return b.attention - a.attention || byName(a, b);
    }
  });
  return scored.map((p, idx) => ({ ...p, rank: idx + 1 }));
}
