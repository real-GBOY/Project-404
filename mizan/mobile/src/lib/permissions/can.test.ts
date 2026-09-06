import { createCan, permissionMatches } from "./can";

describe("permissionMatches", () => {
  it("matches an exact action:resource key", () => {
    expect(permissionMatches("create:matter", "create", "matter")).toBe(true);
    expect(permissionMatches("create:matter", "delete", "matter")).toBe(false);
    expect(permissionMatches("create:matter", "create", "invoice")).toBe(false);
  });

  it("treats * as a wildcard in either segment", () => {
    expect(permissionMatches("*:matter", "read", "matter")).toBe(true);
    expect(permissionMatches("read:*", "read", "anything")).toBe(true);
    expect(permissionMatches("*:*", "whatever", "whatever")).toBe(true);
  });

  it("does not treat a partial string as a wildcard", () => {
    expect(permissionMatches("read:matter", "rea", "matter")).toBe(false);
  });
});

describe("createCan", () => {
  it("returns true when any held permission matches", () => {
    const can = createCan(["read:matter", "create:task"]);
    expect(can("read:matter")).toBe(true);
    expect(can("create:task")).toBe(true);
    expect(can("delete:matter")).toBe(false);
  });

  it("honours wildcards in the held set (admin role)", () => {
    const can = createCan(["*:*"]);
    expect(can("void:invoice")).toBe(true);
  });

  it("rejects malformed keys rather than throwing", () => {
    const can = createCan(["*:*"]);
    expect(can("nonsense")).toBe(false);
    expect(can("")).toBe(false);
    expect(can(":matter")).toBe(false);
  });

  it("an empty permission set can do nothing", () => {
    const can = createCan([]);
    expect(can("read:matter")).toBe(false);
  });
});
