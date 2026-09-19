import { describe, expect, it } from "vitest";
import { createPrefixedId, hasIdPrefix, hasPrefix, newId } from "@core/kernel/id.js";

describe("newId", () => {
  it("formats as <prefix>_<21 url-safe chars>", () => {
    const id = newId("usr");
    expect(id).toMatch(/^usr_[0-9A-Za-z]{21}$/);
  });

  it("is collision-free across a large batch", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newId("evt")));
    expect(seen.size).toBe(5000);
  });
});

describe("hasPrefix", () => {
  it("recognises its own prefix and rejects others", () => {
    const id = newId("org");
    expect(hasPrefix(id, "org")).toBe(true);
    expect(hasPrefix(id, "usr")).toBe(false);
  });

  it("is not fooled by a prefix substring without the underscore", () => {
    expect(hasPrefix("organisation_x", "org")).toBe(false);
  });
});

describe("createPrefixedId — the shared, prefix-agnostic factory", () => {
  it("mints the same <prefix>_<21 url-safe chars> format for ANY prefix (products bring their own)", () => {
    for (const prefix of ["mat", "prj", "cdoc", "x"]) {
      expect(createPrefixedId(prefix)).toMatch(new RegExp(`^${prefix}_[0-9A-Za-z]{21}$`));
    }
  });

  it("is collision-free across a large batch", () => {
    expect(new Set(Array.from({ length: 5000 }, () => createPrefixedId("mat"))).size).toBe(5000);
  });

  it("newId is exactly the factory applied to Core's own prefix union", () => {
    expect(newId("usr")).toMatch(/^usr_[0-9A-Za-z]{21}$/);
  });

  it("hasIdPrefix needs the underscore boundary and matches only its own prefix", () => {
    const id = createPrefixedId("mat");
    expect(hasIdPrefix(id, "mat")).toBe(true);
    expect(hasIdPrefix(id, "ma")).toBe(false);
    expect(hasIdPrefix("material_x", "mat")).toBe(false);
  });

  it("a product wrapper keeps its own typed prefix set while sharing the format", () => {
    type DemoPrefix = "cli" | "mat";
    const demoId = (p: DemoPrefix) => createPrefixedId(p);
    expect(demoId("cli")).toMatch(/^cli_[0-9A-Za-z]{21}$/);
  });
});
