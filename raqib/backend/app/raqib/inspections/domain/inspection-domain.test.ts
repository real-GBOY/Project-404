import { describe, expect, it } from "vitest";
import { guardScore, WeightedComplianceV1 } from "./scoring.js";
import { submissionIssues, type ItemFacts } from "./submission.js";

const facts = (over: Partial<ItemFacts> = {}): ItemFacts => ({
  num: "1.1", step: 0, required: true, evidenceOnNc: true, answer: "c", note: "", storedEvidence: 0, pendingEvidence: 0, flagged: false, touchedSinceFlag: false, ...over,
});

describe("WeightedComplianceV1", () => {
  it("is compliant weight over applicable weight", () => {
    const r = WeightedComplianceV1.score([
      { weight: 3, answer: "c" }, { weight: 2, answer: "n" }, { weight: 5, answer: "c" },
    ]);
    expect(r.pct).toBe(80);
    expect(r).toMatchObject({ compliant: 2, nonCompliant: 1, na: 0, answered: 3, total: 3 });
  });

  it("excludes N/A and unanswered items from the denominator", () => {
    expect(WeightedComplianceV1.score([{ weight: 3, answer: "c" }, { weight: 9, answer: "x" }, { weight: 9, answer: null }]).pct).toBe(100);
  });

  it("is not scoreable (null, not zero) when nothing applicable was answered", () => {
    expect(WeightedComplianceV1.score([{ weight: 3, answer: "x" }, { weight: 2, answer: null }]).pct).toBeNull();
    expect(WeightedComplianceV1.score([]).pct).toBeNull();
  });

  it("a zero-weight non-compliance does not move the score", () => {
    expect(WeightedComplianceV1.score([{ weight: 0, answer: "n" }, { weight: 4, answer: "c" }]).pct).toBe(100);
  });
});

describe("guard score", () => {
  it("is the mean as a percentage of the maximum, done only when every criterion is scored", () => {
    expect(guardScore([4, 4, 5, 4, 4], 5)).toEqual({ done: true, pct: 84, n: 5 });
    expect(guardScore([3, 0, null, 4], 5)).toEqual({ done: false, pct: 70, n: 2 });
    expect(guardScore([], 5)).toEqual({ done: false, pct: null, n: 0 });
  });
});

describe("submission issues", () => {
  const rules = { ncNote: true, ncEvidence: true };
  it("blocks unanswered required items", () => {
    expect(submissionIssues([facts({ answer: null })], [], rules).map((i) => i.code)).toEqual(["unanswered"]);
    expect(submissionIssues([facts({ answer: null, required: false })], [], rules)).toEqual([]);
  });
  it("requires a note and stored evidence for a non-compliance (per settings and item rules)", () => {
    expect(submissionIssues([facts({ answer: "n" })], [], rules).map((i) => i.code)).toEqual(["note_required", "evidence_required"]);
    expect(submissionIssues([facts({ answer: "n", note: "x", storedEvidence: 1 })], [], rules)).toEqual([]);
    expect(submissionIssues([facts({ answer: "n", evidenceOnNc: false, note: "x" })], [], rules)).toEqual([]);
    expect(submissionIssues([facts({ answer: "n" })], [], { ncNote: false, ncEvidence: false })).toEqual([]);
  });
  it("blocks pending uploads, untouched returned items and incomplete guard evaluations", () => {
    const codes = submissionIssues([facts({ pendingEvidence: 1, flagged: true })], [{ name: "Turki", done: false }], rules).map((i) => i.code);
    expect(codes).toEqual(["evidence_pending", "flag_untouched", "guard_incomplete"]);
    expect(submissionIssues([facts({ flagged: true, touchedSinceFlag: true })], [], rules)).toEqual([]);
  });
});
