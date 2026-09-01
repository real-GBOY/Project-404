import { describe, expect, it, vi } from "vitest";
import { RbacPermissionProvider } from "../infrastructure/permission-provider.js";
import type { RbacRepository } from "../infrastructure/rbac-repository.js";
import { withContext } from "../../kernel/logging/context.js";

/** A stub repository — `can()` is the only logic under test here. */
function providerHolding(keys: string[]) {
  const repo = {
    permissionKeysForUser: vi.fn(async () => keys),
    assignRoleToUser: vi.fn(async () => {}),
  } as unknown as RbacRepository;
  return { provider: new RbacPermissionProvider(repo), repo };
}

/** Permissions resolve within the active tenant (§ docs/tenancy.md). */
const inOrg = <T>(fn: () => Promise<T>) => withContext({ organizationId: "org_1" }, fn);

describe("RbacPermissionProvider.can", () => {
  it("is true when a held key matches the (action, resource)", async () => {
    const { provider } = providerHolding(["read:file", "manage:role"]);
    expect(await inOrg(() => provider.can("usr_1", "read", "file"))).toBe(true);
  });

  it("is false when no held key matches", async () => {
    const { provider } = providerHolding(["read:file"]);
    expect(await inOrg(() => provider.can("usr_1", "delete", "file"))).toBe(false);
  });

  it("honours the superuser wildcard", async () => {
    const { provider } = providerHolding(["*:*"]);
    expect(await inOrg(() => provider.can("usr_1", "anything", "whatever"))).toBe(true);
  });

  it("is false for a user holding no permissions", async () => {
    const { provider } = providerHolding([]);
    expect(await inOrg(() => provider.can("usr_1", "read", "file"))).toBe(false);
  });

  it("is false — with no repo call — when there is no active tenant", async () => {
    const { provider, repo } = providerHolding(["*:*"]);
    expect(await provider.can("usr_1", "read", "file")).toBe(false);
    expect(repo.permissionKeysForUser).not.toHaveBeenCalled();
  });

  it("checks against live data on every call", async () => {
    const { provider, repo } = providerHolding(["read:file"]);
    await inOrg(() => provider.can("usr_1", "read", "file"));
    await inOrg(() => provider.can("usr_1", "read", "file"));
    expect(repo.permissionKeysForUser).toHaveBeenCalledTimes(2);
  });
});

describe("RbacPermissionProvider.assignRole", () => {
  it("delegates to the repository, scoped to the active tenant", async () => {
    const { provider, repo } = providerHolding([]);
    await inOrg(() => provider.assignRole("usr_1", "role_1"));
    expect(repo.assignRoleToUser).toHaveBeenCalledWith("usr_1", "role_1", "org_1");
  });

  it("throws when there is no active tenant", async () => {
    const { provider } = providerHolding([]);
    await expect(provider.assignRole("usr_1", "role_1")).rejects.toThrow(/organization/i);
  });
});
