import { describe, expect, it } from "vitest";
import { defaultStageFromStatus, isDeal } from "@atlas/realestate/crm/domain/lead.domain.js";

describe("realestate/crm lead.domain", () => {
  it("defaultStageFromStatus maps a lead status straight onto the pipeline's stage superset", () => {
    expect(defaultStageFromStatus("new")).toBe("new");
    expect(defaultStageFromStatus("negotiation")).toBe("negotiation");
    expect(defaultStageFromStatus("lost")).toBe("lost");
  });

  it("isDeal is true once either deal-tracking field is set", () => {
    expect(isDeal({ probabilityPct: null, expectedCloseDate: null })).toBe(false);
    expect(isDeal({ probabilityPct: "60.00", expectedCloseDate: null })).toBe(true);
    expect(isDeal({ probabilityPct: null, expectedCloseDate: "2026-12-01" })).toBe(true);
  });
});
