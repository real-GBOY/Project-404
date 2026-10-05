import { describe, expect, it } from "vitest";
import { effectiveStatus, next } from "./visit-state.js";

describe("visit lifecycle", () => {
  it("schedules as assigned only when an inspector is named", () => {
    expect(next(null, "schedule", true)).toBe("assigned");
    expect(next(null, "schedule", false)).toBe("scheduled");
    expect(next("assigned", "schedule", true)).toBeNull();
  });

  it("assigning an inspector to an unassigned visit assigns it; other statuses stay put", () => {
    expect(next("scheduled", "assign", true)).toBe("assigned");
    expect(next("in_progress", "reschedule", true)).toBe("in_progress");
    expect(next("returned", "reschedule", true)).toBe("returned");
  });

  it("cannot reschedule or cancel a visit under review or already decided", () => {
    for (const s of ["pending_review", "pending_approval", "approved", "rejected", "cancelled"] as const) {
      expect(next(s, "reschedule", true)).toBeNull();
      expect(next(s, "cancel", true)).toBeNull();
    }
    expect(next("assigned", "cancel", true)).toBe("cancelled");
  });

  it("derives overdue from the schedule, in the organization's time zone", () => {
    const v = { status: "assigned" as const, date: "2026-10-02", time: "09:00" };
    // 09:00 Riyadh (UTC+3) = 06:00Z; overdue after 24 h
    expect(effectiveStatus(v, new Date("2026-10-03T05:59:00Z"), 24, "Asia/Riyadh")).toBe("assigned");
    expect(effectiveStatus(v, new Date("2026-10-03T06:01:00Z"), 24, "Asia/Riyadh")).toBe("overdue");
  });

  it("never marks a started or decided visit overdue", () => {
    const v = { status: "in_progress" as const, date: "2026-01-01", time: "09:00" };
    expect(effectiveStatus(v, new Date("2026-10-03T00:00:00Z"), 24, "Asia/Riyadh")).toBe("in_progress");
  });
});
