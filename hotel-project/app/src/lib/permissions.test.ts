import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("matches an exact action:resource key", () => {
    expect(hasPermission(["read:reservation"], "read:reservation")).toBe(true);
    expect(hasPermission(["read:reservation"], "create:reservation")).toBe(false);
  });

  it("honours wildcards on either side, like Core RBAC", () => {
    expect(hasPermission(["*:*"], "refund:payment")).toBe(true);
    expect(hasPermission(["*:reservation"], "cancel:reservation")).toBe(true);
    expect(hasPermission(["read:*"], "read:invoice")).toBe(true);
    expect(hasPermission(["read:*"], "create:invoice")).toBe(false);
  });

  it("denies with no permissions at all", () => {
    expect(hasPermission([], "read:guest")).toBe(false);
  });
});
