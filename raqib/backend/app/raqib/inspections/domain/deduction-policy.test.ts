import { describe, expect, it } from "vitest";
import { DEDUCTION_POLICY, deductionPolicy, policyFor, type DeductionConfig } from "./scoring.js";

const cfg: DeductionConfig = { id: "scf_1", version: 1, base: 100, bySeverity: { low: 2, medium: 5, high: 10 }, byItem: { q9: 12 } };
const policy = deductionPolicy(cfg);

describe("deduction scoring", () => {
  it("starts from 100 and takes the configured amount off each non-compliant item", () => {
    const r = policy.score([
      { weight: 1, id: "a", key: "q1", answer: "c" },
      { weight: 1, id: "b", key: "q2", answer: "n", severity: "medium" },
      { weight: 1, id: "c", key: "q3", answer: "n", severity: "high" },
      { weight: 1, id: "d", key: "q4", answer: "x" },
    ]);
    expect(r.pct).toBe(85);
    expect(r).toMatchObject({ compliant: 1, nonCompliant: 2, na: 1, answered: 4, total: 4 });
    expect(r.deductions?.map((d) => d.amount)).toEqual([5, 10]);
  });

  it("lets an item-specific amount override the severity amount", () => {
    expect(policy.score([{ weight: 1, id: "a", key: "q9", answer: "n", severity: "low" }]).pct).toBe(88);
  });

  it("never deducts twice for the same recorded violation", () => {
    const item = { weight: 1, id: "a", key: "q2", answer: "n" as const, severity: "high" as const };
    expect(policy.score([item, item, item]).pct).toBe(90);
  });

  it("never falls below zero", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ weight: 1, id: `i${i}`, key: `k${i}`, answer: "n" as const, severity: "high" as const }));
    expect(policy.score(items).pct).toBe(0);
  });

  it("reports a violation with no configured amount instead of guessing one", () => {
    const sparse = deductionPolicy({ ...cfg, bySeverity: { high: 10 }, byItem: {} });
    const r = sparse.score([
      { weight: 1, id: "a", key: "q2", answer: "n", severity: "low" },
      { weight: 1, id: "b", key: "q3", answer: "n" },
    ]);
    expect(r.pct).toBe(100);
    expect(r.unpriced).toEqual(["q2", "q3"]);
  });

  it("scores 100 when everything applicable is compliant and nothing when nothing is scoreable", () => {
    expect(policy.score([{ weight: 1, id: "a", key: "q1", answer: "c" }]).pct).toBe(100);
    expect(policy.score([{ weight: 1, id: "a", key: "q1", answer: "x" }]).pct).toBeNull();
    expect(policy.score([{ weight: 1, id: "a", key: "q1", answer: null }]).pct).toBeNull();
  });

  it("is only available with its configuration", () => {
    expect(() => policyFor(DEDUCTION_POLICY)).toThrow();
    expect(policyFor(DEDUCTION_POLICY, cfg).key).toBe(DEDUCTION_POLICY);
  });

  it("keeps scoring an old configuration the way it was published", () => {
    const v1 = deductionPolicy(cfg);
    const v2 = deductionPolicy({ ...cfg, id: "scf_2", version: 2, byItem: { q9: 20 } });
    const items = [{ weight: 1, id: "a", key: "q9", answer: "n" as const, severity: "high" as const }];
    expect(v1.score(items).pct).toBe(88);
    expect(v2.score(items).pct).toBe(80);
  });
});
