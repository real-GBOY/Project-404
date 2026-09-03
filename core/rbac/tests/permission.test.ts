import { describe, expect, it } from "vitest";
import {
  parsePermissionKey,
  permissionKey,
  permissionMatches,
} from "@core/rbac/domain/permission.js";

describe("permission keys", () => {
  it("builds and parses action:resource", () => {
    expect(permissionKey("create", "employee")).toBe("create:employee");
    expect(parsePermissionKey("create:employee")).toEqual({
      action: "create",
      resource: "employee",
    });
    expect(parsePermissionKey("bad")).toBeNull();
    expect(parsePermissionKey(":employee")).toBeNull();
    expect(parsePermissionKey("create:")).toBeNull();
  });
});

describe("permissionMatches", () => {
  it("matches exact", () => {
    expect(permissionMatches("create:employee", "create", "employee")).toBe(true);
    expect(permissionMatches("read:employee", "create", "employee")).toBe(false);
  });

  it("honours wildcards", () => {
    expect(permissionMatches("*:*", "anything", "whatever")).toBe(true);
    expect(permissionMatches("read:*", "read", "invoice")).toBe(true);
    expect(permissionMatches("read:*", "write", "invoice")).toBe(false);
    expect(permissionMatches("*:invoice", "delete", "invoice")).toBe(true);
    expect(permissionMatches("*:invoice", "delete", "employee")).toBe(false);
  });
});
