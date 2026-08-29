import type { IPermissionProvider } from "../../contracts/index.js";
import { permissionMatches } from "../domain/permission.js";
import type { RbacRepository } from "./rbac-repository.js";

/**
 * RBAC's implementation of the IPermissionProvider contract (§4). This is how
 * every module and the HTTP layer answer "can this user do this?" — always
 * against live data, so a revoked role takes effect immediately.
 */
export class RbacPermissionProvider implements IPermissionProvider {
  constructor(private readonly repo: RbacRepository) {}

  async can(userId: string, action: string, resource: string): Promise<boolean> {
    const held = await this.repo.permissionKeysForUser(userId);
    return held.some((key) => permissionMatches(key, action, resource));
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.repo.assignRoleToUser(userId, roleId);
  }

  async permissionsFor(userId: string): Promise<string[]> {
    return this.repo.permissionKeysForUser(userId);
  }
}
