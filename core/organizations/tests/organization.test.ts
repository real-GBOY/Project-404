import { describe, expect, it } from "vitest";
import { slugify } from "../domain/organization.js";

describe("slugify", () => {
  it("lower-cases and hyphenates whitespace", () => {
    expect(slugify("Acme Egypt")).toBe("acme-egypt");
    expect(slugify("  Leading and trailing  ")).toBe("leading-and-trailing");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Déjà")).toBe("cafe-deja");
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    expect(slugify("a  --  b__c!!d")).toBe("a-b-c-d");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("!!! wow !!!")).toBe("wow");
  });

  it("caps the result at 60 characters", () => {
    expect(slugify("x".repeat(200)).length).toBe(60);
  });

  it("yields an empty string when there is nothing latin to keep", () => {
    expect(slugify("شركة")).toBe("");
  });
});
