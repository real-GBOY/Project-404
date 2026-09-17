import { describe, expect, it } from "vitest";
import { recommendNextAction } from "../domain/next-action.domain.js";
import type { UnitMatchResult } from "../domain/lead-matching.domain.js";

function match(score: number, code = "A-0101"): UnitMatchResult {
  return { id: code, code, projectId: "prj_hills", projectName: "North Hills", unitType: "3-Bed", floor: 3, areaSqm: 178, basePriceEgp: 6_400_000, score, reasons: [] };
}

describe("lead-intelligence/domain next-action", () => {
  it("a lost lead gets no action, regardless of anything else", () => {
    const result = recommendNextAction({ leadStatus: "lost", requirementsExtracted: true, hasBudget: true, matches: [match(95)] });
    expect(result.action).toBe("No action needed");
  });

  it("no extraction yet takes priority over everything downstream", () => {
    const result = recommendNextAction({ leadStatus: "new", requirementsExtracted: false, hasBudget: false, matches: [] });
    expect(result.action).toMatch(/requirements/i);
  });

  it("requirements extracted but no budget asks for a budget", () => {
    const result = recommendNextAction({ leadStatus: "qualified", requirementsExtracted: true, hasBudget: false, matches: [] });
    expect(result.action).toMatch(/budget/i);
  });

  it("no matches at all suggests alternatives", () => {
    const result = recommendNextAction({ leadStatus: "qualified", requirementsExtracted: true, hasBudget: true, matches: [] });
    expect(result.action).toMatch(/alternative/i);
  });

  it("a strong top match (>=85) recommends scheduling a visit", () => {
    const result = recommendNextAction({ leadStatus: "qualified", requirementsExtracted: true, hasBudget: true, matches: [match(94)] });
    expect(result.action).toMatch(/site visit/i);
    expect(result.reason).toContain("94%");
  });

  it("a usable-but-not-great top match (60-84) recommends sending details", () => {
    const result = recommendNextAction({ leadStatus: "qualified", requirementsExtracted: true, hasBudget: true, matches: [match(70)] });
    expect(result.action).toMatch(/send property details/i);
  });

  it("a weak top match (<60) suggests presenting alternative units", () => {
    const result = recommendNextAction({ leadStatus: "qualified", requirementsExtracted: true, hasBudget: true, matches: [match(35)] });
    expect(result.action).toMatch(/weak fit/i);
  });
});
