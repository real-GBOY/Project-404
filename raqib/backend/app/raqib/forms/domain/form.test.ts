import { describe, expect, it } from "vitest";
import { diffVersions, nextVersionLabel, publishIssues, type FormSection } from "./form.js";

const item = (key: string, weight = 1, over: Partial<FormSection["items"][number]> = {}) => ({
  key,
  text: { ar: `س ${key}`, en: `Q ${key}` },
  weight,
  type: "cnx" as const,
  required: true,
  na: true,
  evidenceOnNc: true,
  ...over,
});
const sec = (key: string, ...items: FormSection["items"]): FormSection => ({ key, title: { ar: key, en: key }, items });

describe("form versions", () => {
  it("computes the next version label from the highest existing one", () => {
    expect(nextVersionLabel([])).toBe("1.0");
    expect(nextVersionLabel(["1.4", "2.0", "2.1"])).toBe("2.2");
  });

  it("refuses to publish an empty, duplicated or unweighted structure", () => {
    expect(publishIssues([]).map((i) => i.code)).toEqual(["no_sections"]);
    expect(publishIssues([sec("a")]).map((i) => i.code)).toContain("empty_section");
    expect(publishIssues([sec("a", item("q1"), item("q1"))]).map((i) => i.code)).toContain("duplicate_key");
    expect(publishIssues([sec("a", item("q1", 0))]).map((i) => i.code)).toContain("no_weight");
    expect(publishIssues([sec("a", item("q1", 2))])).toEqual([]);
  });

  it("diffs by stable item key: added, removed, weight, text, rules, sections", () => {
    const prev = [sec("a", item("q1", 3), item("q2", 2)), sec("b", item("q3", 1))];
    const next = [sec("a", item("q1", 2), item("q4", 1, {}), item("q2", 2, { na: false }))];
    const kinds = diffVersions(prev, next).map((c) => `${c.kind}:${"num" in c ? c.num : ""}`);
    expect(kinds).toContain("weight:1.1");
    expect(kinds).toContain("added:1.2");
    expect(kinds).toContain("rules:1.3");
    expect(kinds).toContain("removed:2.1");
    expect(kinds).toContain("sections:");
  });

  it("treats the first version as all additions", () => {
    expect(diffVersions(null, [sec("a", item("q1"))]).map((c) => c.kind)).toEqual(["added"]);
  });
});
