import { describe, expect, it } from "vitest";
import { isEscalated, letterForTraining, nextTraining } from "./training-state.js";

describe("training request state machine", () => {
  it("allows the documented moves", () => {
    expect(nextTraining("pending_pm", "approve")).toBe("approved");
    expect(nextTraining("pending_pm", "return")).toBe("returned");
    expect(nextTraining("pending_pm", "reject")).toBe("rejected");
    expect(nextTraining("returned", "resubmit")).toBe("pending_pm");
    expect(nextTraining("approved", "schedule")).toBe("scheduled");
    expect(nextTraining("scheduled", "complete")).toBe("completed");
  });
  it("refuses everything else; rejected and completed are final", () => {
    expect(nextTraining("approved", "approve")).toBeNull();
    expect(nextTraining("pending_pm", "schedule")).toBeNull();
    expect(nextTraining("returned", "approve")).toBeNull();
    for (const s of ["approve", "return", "reject", "resubmit", "schedule", "complete"] as const) {
      expect(nextTraining("rejected", s)).toBeNull();
      expect(nextTraining("completed", s)).toBeNull();
    }
  });
  it("separates deciding, resubmitting and running the training", () => {
    expect(letterForTraining("approve")).toBe("P");
    expect(letterForTraining("resubmit")).toBe("E");
    expect(letterForTraining("schedule")).toBe("R");
    expect(letterForTraining("complete")).toBe("R");
  });
  it("derives escalation from how long a request has waited for the manager", () => {
    expect(isEscalated("pending_pm", "2026-10-01T09:00:00Z", "2026-10-04")).toBe(true);
    expect(isEscalated("pending_pm", "2026-10-02T09:00:00Z", "2026-10-04")).toBe(false);
    expect(isEscalated("approved", "2026-09-01T09:00:00Z", "2026-10-04")).toBe(false);
  });
});
