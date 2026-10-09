import { describe, expect, it } from "vitest";
import { ruleViolations, windowOf, type ScheduleRules, type ShiftDef, type Slot } from "./schedule-rules.js";

const shifts: ShiftDef[] = [
  { key: "day", nameAr: "نهارية", nameEn: "Day", start: "06:00", end: "14:00" },
  { key: "night", nameAr: "ليلية", nameEn: "Night", start: "22:00", end: "06:00" },
  { key: "open", nameAr: "مفتوحة", nameEn: "Open", start: "", end: "" },
];
const off: ScheduleRules = { minRestHours: 0, maxConsecutiveDays: 0 };
const slot = (date: string, shift: string, time = "09:00"): Slot => ({ date, time, shift });

describe("schedule rules", () => {
  it("enforces nothing while both rules are 0", () => {
    expect(ruleViolations(slot("2026-10-05", "day"), [slot("2026-10-05", "day", "13:00")], shifts, off)).toEqual([]);
  });

  it("treats a shift that ends before it starts as running into the next day", () => {
    const [s, e] = windowOf(slot("2026-10-05", "night"), shifts);
    expect(e - s).toBe(8 * 60);
  });

  it("requires the configured rest between two shifts of the same person", () => {
    const rules = { ...off, minRestHours: 11 };
    // a night shift ends 06:00 on the 6th; a day shift starting 06:00 the same morning has no rest at all
    expect(ruleViolations(slot("2026-10-06", "day"), [slot("2026-10-05", "night")], shifts, rules)).toHaveLength(1);
    // the next day shift after a day shift: 14:00 → 06:00 is 16 hours
    expect(ruleViolations(slot("2026-10-06", "day"), [slot("2026-10-05", "day")], shifts, rules)).toEqual([]);
    // two shifts on top of each other overlap
    expect(ruleViolations(slot("2026-10-05", "day"), [slot("2026-10-05", "day", "10:00")], shifts, rules)).toHaveLength(1);
  });

  it("uses the scheduled time when a shift has no configured hours", () => {
    const rules = { ...off, minRestHours: 3 };
    expect(ruleViolations(slot("2026-10-05", "open", "09:00"), [slot("2026-10-05", "open", "11:00")], shifts, rules)).toHaveLength(1);
    expect(ruleViolations(slot("2026-10-05", "open", "09:00"), [slot("2026-10-05", "open", "12:00")], shifts, rules)).toEqual([]);
  });

  it("caps the number of consecutive days, counting the new visit", () => {
    const rules = { ...off, maxConsecutiveDays: 3 };
    const existing = [slot("2026-10-05", "day"), slot("2026-10-06", "day")];
    expect(ruleViolations(slot("2026-10-07", "day"), existing, shifts, rules)).toEqual([]);
    expect(ruleViolations(slot("2026-10-07", "day"), [...existing, slot("2026-10-08", "day")], shifts, rules)).toEqual([{ rule: "consecutive", days: 4 }]);
    // a gap day breaks the run
    expect(ruleViolations(slot("2026-10-09", "day"), [...existing, slot("2026-10-08", "day")].slice(0, 2), shifts, rules)).toEqual([]);
  });
});
