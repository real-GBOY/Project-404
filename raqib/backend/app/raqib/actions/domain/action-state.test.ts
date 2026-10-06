import { describe, expect, it } from "vitest";
import { effectiveActionStatus, evidenceOpen, letterForStep, nextAction } from "./action-state.js";

describe("corrective action state machine", () => {
  it("allows only the documented moves", () => {
    expect(nextAction("assigned", "start")).toBe("in_progress");
    expect(nextAction("returned", "start")).toBe("in_progress");
    expect(nextAction("in_progress", "submit")).toBe("quality_review");
    expect(nextAction("quality_review", "return")).toBe("returned");
    expect(nextAction("quality_review", "close")).toBe("closed");
  });

  it("refuses everything else, and nothing leaves closed", () => {
    expect(nextAction("assigned", "submit")).toBeNull();
    expect(nextAction("in_progress", "close")).toBeNull();
    expect(nextAction("in_progress", "return")).toBeNull();
    expect(nextAction("assigned", "close")).toBeNull();
    for (const s of ["start", "submit", "return", "close"] as const) expect(nextAction("closed", s)).toBeNull();
  });

  it("derives overdue from the due date, only for work not yet in quality review", () => {
    expect(effectiveActionStatus("assigned", "2026-10-03", "2026-10-04")).toBe("overdue");
    expect(effectiveActionStatus("in_progress", "2026-10-04", "2026-10-04")).toBe("in_progress");
    expect(effectiveActionStatus("returned", "2026-10-01", "2026-10-04")).toBe("overdue");
    expect(effectiveActionStatus("quality_review", "2026-10-01", "2026-10-04")).toBe("quality_review");
    expect(effectiveActionStatus("closed", "2026-10-01", "2026-10-04")).toBe("closed");
  });

  it("separates doing the work, reviewing it and closing it", () => {
    expect(letterForStep("start")).toBe("S");
    expect(letterForStep("submit")).toBe("S");
    expect(letterForStep("return")).toBe("R");
    expect(letterForStep("close")).toBe("P");
    expect(evidenceOpen("in_progress")).toBe(true);
    expect(evidenceOpen("quality_review")).toBe(false);
  });
});
