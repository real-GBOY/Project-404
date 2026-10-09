/**
 * Escalation of unresolved corrective actions (pure). How days are counted and who is told at each level are the
 * organization's settings (`settings.escalation`); nothing about the client's rules is built in here.
 */
export interface EscalationLevel {
  /** Days elapsed at which this level applies. */
  days: number;
  /** Role keys to tell, plus "responsible" for the person the action is assigned to. */
  roles: string[];
}
export interface EscalationRules {
  enabled: boolean;
  /** Count from the day the action was assigned, or from its due date. */
  countFrom: "assigned" | "due";
  /** Weekdays (0 = Sunday … 6 = Saturday) that do not count. Empty = calendar days. */
  weekend: number[];
  levels: EscalationLevel[];
  highSeverity: { immediate: boolean; roles: string[] };
}

const DAY = 86_400_000;
const atUtc = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

/** Whole days after `from` up to and including `today` that count (weekend days excluded). Never negative. */
export function elapsedDays(from: string, today: string, weekend: number[]): number {
  const start = atUtc(from);
  const end = atUtc(today);
  let n = 0;
  for (let t = start + DAY; t <= end; t += DAY) {
    if (!weekend.includes(new Date(t).getUTCDay())) n++;
  }
  return n;
}

/** The highest level whose threshold has been reached (0 = none). Levels are taken in ascending order of days. */
export function levelReached(elapsed: number, levels: EscalationLevel[]): number {
  const sorted = [...levels].sort((a, b) => a.days - b.days);
  let reached = 0;
  sorted.forEach((l, idx) => {
    if (elapsed >= l.days) reached = idx + 1;
  });
  return reached;
}

/** The day an escalation count starts from for an action. */
export const countStart = (rules: Pick<EscalationRules, "countFrom">, a: { createdAt: Date; dueDate: string }): string =>
  rules.countFrom === "due" ? a.dueDate : a.createdAt.toISOString().slice(0, 10);
