import { describe, expect, it } from "vitest";
import { countStart, elapsedDays, levelReached, type EscalationLevel } from "./escalation.js";

const levels: EscalationLevel[] = [
  { days: 3, roles: ["pm"] },
  { days: 6, roles: ["qm"] },
  { days: 9, roles: ["gm"] },
];

describe("escalation counting", () => {
  it("counts calendar days after the start day when no weekend is configured", () => {
    expect(elapsedDays("2026-10-01", "2026-10-01", [])).toBe(0);
    expect(elapsedDays("2026-10-01", "2026-10-04", [])).toBe(3);
    expect(elapsedDays("2026-10-01", "2026-10-10", [])).toBe(9);
  });

  it("skips configured weekend days", () => {
    // 2026-10-01 is a Thursday; Friday (5) and Saturday (6) do not count
    expect(elapsedDays("2026-10-01", "2026-10-04", [5, 6])).toBe(1); // only Sunday counts
    expect(elapsedDays("2026-10-01", "2026-10-08", [5, 6])).toBe(5); // Sun Mon Tue Wed Thu
  });

  it("is never negative", () => {
    expect(elapsedDays("2026-10-10", "2026-10-01", [])).toBe(0);
  });

  it("finds the highest level reached, in ascending order whatever the configured order", () => {
    expect(levelReached(2, levels)).toBe(0);
    expect(levelReached(3, levels)).toBe(1);
    expect(levelReached(5, levels)).toBe(1);
    expect(levelReached(6, levels)).toBe(2);
    expect(levelReached(40, levels)).toBe(3);
    expect(levelReached(7, [...levels].reverse())).toBe(2);
  });

  it("starts counting from assignment or from the due date, as configured", () => {
    const a = { createdAt: new Date("2026-10-02T09:00:00Z"), dueDate: "2026-10-12" };
    expect(countStart({ countFrom: "assigned" }, a)).toBe("2026-10-02");
    expect(countStart({ countFrom: "due" }, a)).toBe("2026-10-12");
  });
});
