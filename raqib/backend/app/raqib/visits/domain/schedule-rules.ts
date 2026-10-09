/**
 * Scheduling rules for one inspector, as pure functions. The client's real rule values are configuration
 * (`settings.schedule`): with both set to 0 nothing is enforced. A visit is a point in time (its scheduled time) unless
 * its shift has configured start and end times, in which case it occupies that window.
 */
export interface ShiftDef {
  key: string;
  nameAr: string;
  nameEn: string;
  /** "HH:MM", or "" while the client has not supplied the times. */
  start: string;
  end: string;
}
export interface ScheduleRules {
  /** Minimum hours between the end of one assignment and the start of the next for the same inspector. 0 = no rule. */
  minRestHours: number;
  /** Most calendar days in a row an inspector may be assigned. 0 = no rule. */
  maxConsecutiveDays: number;
}
export interface Slot {
  date: string;
  time: string;
  shift: string;
}
export type RuleViolation = { rule: "rest"; with: Slot } | { rule: "consecutive"; days: number };

const MIN = 60_000;
const at = (date: string, hhmm: string): number => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  return Date.UTC(y, m - 1, d, h, mi) / MIN;
};

/** [start, end] in minutes. A shift ending at or before its start runs into the next day (e.g. 22:00–06:00). */
export function windowOf(slot: Slot, shifts: ShiftDef[]): [number, number] {
  const def = shifts.find((s) => s.key === slot.shift);
  if (def?.start && def.end) {
    const start = at(slot.date, def.start);
    let end = at(slot.date, def.end);
    if (end <= start) end += 24 * 60;
    return [start, end];
  }
  const t = at(slot.date, slot.time);
  return [t, t];
}

const dayNumber = (date: string): number => Math.round(at(date, "00:00") / (24 * 60));

export function ruleViolations(candidate: Slot, existing: Slot[], shifts: ShiftDef[], rules: ScheduleRules): RuleViolation[] {
  const out: RuleViolation[] = [];
  if (rules.minRestHours > 0) {
    const [cs, ce] = windowOf(candidate, shifts);
    const rest = rules.minRestHours * 60;
    for (const other of existing) {
      const [os, oe] = windowOf(other, shifts);
      const gap = cs >= oe ? cs - oe : os >= ce ? os - ce : -1; // -1: the two overlap
      if (gap < rest) out.push({ rule: "rest", with: other });
    }
  }
  if (rules.maxConsecutiveDays > 0) {
    const days = new Set([...existing.map((s) => dayNumber(s.date)), dayNumber(candidate.date)]);
    let run = 1;
    for (let d = dayNumber(candidate.date) - 1; days.has(d); d--) run++;
    for (let d = dayNumber(candidate.date) + 1; days.has(d); d++) run++;
    if (run > rules.maxConsecutiveDays) out.push({ rule: "consecutive", days: run });
  }
  return out;
}

/** The day span another slot of the same inspector could matter for: enough to see a run and a rest window. */
export function lookAroundDays(rules: ScheduleRules): number {
  return Math.max(rules.maxConsecutiveDays, Math.ceil(rules.minRestHours / 24) + 1, 1);
}
