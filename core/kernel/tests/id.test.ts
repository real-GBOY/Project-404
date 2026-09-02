import { describe, expect, it } from "vitest";
import { hasPrefix, newId } from "@core/kernel/id.js";

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
