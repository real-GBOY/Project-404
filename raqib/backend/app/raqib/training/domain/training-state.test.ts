import { describe, expect, it } from "vitest";
import { initialStatus, isEscalated, letterForTraining, nextTraining } from "./training-state.js";

describe("training request state machine", () => {
  it("allows the documented moves for a request that starts with the project manager", () => {
    expect(nextTraining("pending_pm", "approve")).toBe("approved");
    expect(nextTraining("pending_pm", "return")).toBe("returned");
    expect(nextTraining("pending_pm", "reject")).toBe("rejected");
    expect(nextTraining("returned", "resubmit")).toBe("pending_pm");
    expect(nextTraining("approved", "schedule")).toBe("scheduled");
    expect(nextTraining("scheduled", "complete")).toBe("completed");
  });

  it("puts a guard's request with a supervisor first, then the project manager, then quality", () => {
    expect(initialStatus("guard", true)).toBe("pending_supervisor");
    expect(initialStatus("supervisor", true)).toBe("pending_pm");
    expect(initialStatus("guard", false)).toBe("pending_pm"); // the supervisor stage can be switched off
    expect(nextTraining("pending_supervisor", "review")).toBe("pending_pm");
    expect(nextTraining("pending_supervisor", "return")).toBe("returned");
    expect(nextTraining("pending_supervisor", "reject")).toBe("rejected");
    // a returned guard request goes back to where it started
    expect(nextTraining("returned", "resubmit", "pending_supervisor")).toBe("pending_supervisor");
    expect(nextTraining("returned", "resubmit", "pending_pm")).toBe("pending_pm");
  });

  it("does not let a stage be skipped", () => {
    expect(nextTraining("pending_supervisor", "approve")).toBeNull();
    expect(nextTraining("pending_supervisor", "schedule")).toBeNull();
    expect(nextTraining("pending_pm", "review")).toBeNull();
  });

  it("refuses everything else; rejected and completed are final", () => {
    expect(nextTraining("approved", "approve")).toBeNull();
    expect(nextTraining("pending_pm", "schedule")).toBeNull();
    expect(nextTraining("returned", "approve")).toBeNull();
    for (const s of ["review", "approve", "return", "reject", "resubmit", "schedule", "complete"] as const) {
      expect(nextTraining("rejected", s)).toBeNull();
      expect(nextTraining("completed", s)).toBeNull();
    }
  });

  it("separates the supervisor's, the project manager's and quality's rights", () => {
    expect(letterForTraining("review", "pending_supervisor")).toBe("S");
    expect(letterForTraining("return", "pending_supervisor")).toBe("S");
    expect(letterForTraining("reject", "pending_supervisor")).toBe("S");
    expect(letterForTraining("approve", "pending_pm")).toBe("P");
    expect(letterForTraining("return", "pending_pm")).toBe("P");
    expect(letterForTraining("resubmit", "returned")).toBe("E");
    expect(letterForTraining("schedule", "approved")).toBe("R");
    expect(letterForTraining("complete", "scheduled")).toBe("R");
  });

  it("derives escalation from how long a request has waited for a decision", () => {
    expect(isEscalated("pending_pm", "2026-10-01T09:00:00Z", "2026-10-04")).toBe(true);
    expect(isEscalated("pending_supervisor", "2026-10-01T09:00:00Z", "2026-10-04")).toBe(true);
    expect(isEscalated("pending_pm", "2026-10-02T09:00:00Z", "2026-10-04")).toBe(false);
    expect(isEscalated("approved", "2026-09-01T09:00:00Z", "2026-10-04")).toBe(false);
  });
});
