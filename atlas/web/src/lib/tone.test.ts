import { describe, expect, it } from "vitest";
import { toneOf } from "./tone";

describe("toneOf", () => {
  it("resolves known statuses to their design tone", () => {
    expect(toneOf("Available")).toBe("success");
    expect(toneOf("Sold")).toBe("brand");
    expect(toneOf("Overdue")).toBe("danger");
    expect(toneOf("Reserved")).toBe("warning");
  });

  it("falls back to muted for unknown statuses", () => {
    expect(toneOf("Something Unmapped")).toBe("muted");
  });
});
