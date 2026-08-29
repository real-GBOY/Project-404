import { describe, expect, it, vi } from "vitest";
import { RbacPermissionProvider } from "../infrastructure/permission-provider.js";
import type { RbacRepository } from "../infrastructure/rbac-repository.js";

/** A stub repository — `can()` is the only logic under test here. */
function providerHolding(keys: string[]) {
  const repo = {
    permissionKeysForUser: vi.fn(async () => keys),
    assignRoleToUser: vi.fn(async () => {}),
  } as unknown as RbacRepository;
  return { provider: new RbacPermissionProvider(repo), repo };
}

describe("RbacPermissionProvider.can", () => {
  it("is true when a held key matches the (action, resource)", async () => {
    const { provider } = providerHolding(["read:file", "manage:role"]);
    expect(await provider.can("usr_1", "read", "file")).toBe(true);
  });

  it("is false when no held key matches", async () => {
    const { provider } = providerHolding(["read:file"]);
    expect(await provider.can("usr_1", "delete", "file")).toBe(false);
  });

  it("honours the superuser wildcard", async () => {
    const { provider } = providerHolding(["*:*"]);
    expect(await provider.can("usr_1", "anything", "whatever")).toBe(true);
  });

  it("is false for a user holding no permissions", async () => {
    const { provider } = providerHolding([]);
    expect(await provider.can("usr_1", "read", "file")).toBe(false);
  });

  it("checks against live data on every call", async () => {
    const { provider, repo } = providerHolding(["read:file"]);
    await provider.can("usr_1", "read", "file");
    await provider.can("usr_1", "read", "file");
    expect(repo.permissionKeysForUser).toHaveBeenCalledTimes(2);
  });
});

describe("RbacPermissionProvider.assignRole", () => {
  it("delegates to the repository", async () => {
    const { provider, repo } = providerHolding([]);
    await provider.assignRole("usr_1", "role_1");
    expect(repo.assignRoleToUser).toHaveBeenCalledWith("usr_1", "role_1");
  });
});
