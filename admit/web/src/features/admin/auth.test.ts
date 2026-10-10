import { describe, expect, it } from "vitest";
import { hasPermission } from "./auth";

describe("hasPermission", () => {
  const held = ["read:event", "approve:payment", "manage:*"];
  it("matches exact keys", () => {
    expect(hasPermission(held, "approve:payment")).toBe(true);
    expect(hasPermission(held, "reject:payment")).toBe(false);
  });
  it("honours Core's wildcards", () => {
    expect(hasPermission(held, "manage:ticket_type")).toBe(true);
    expect(hasPermission(["*:*"], "anything:at_all")).toBe(true);
    expect(hasPermission(["read:*"], "read:booking")).toBe(true);
    expect(hasPermission(["read:*"], "update:booking")).toBe(false);
  });
  it("denies when nothing is held", () => {
    expect(hasPermission([], "read:event")).toBe(false);
  });
});
