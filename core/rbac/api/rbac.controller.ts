import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { RequirePermission, CurrentUser } from "@core/http/decorators.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import {
  assignRoleSchema,
  createRoleSchema,
  grantPermissionSchema,
} from "@core/rbac/validation/schemas.js";
import type { z } from "zod";

/**
 * RBAC administration (§7.2). `roles` and `permissions` are global (system-wide);
 * only *assignments* (`user_roles`) are tenant-scoped, so `assign` / `unassign` /
 * the user lookup act on the caller's **active tenant** (§ docs/tenancy.md).
 * Every route needs an authenticated caller plus the stated permission.
 */
@Controller("rbac")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacController {
  constructor(private readonly service: RbacService) {}

  /** GET /api/rbac/roles — every role and its permission set. */
  @Get("roles")
  @RequirePermission("read", "role")
  async listRoles() {
    return { roles: await this.service.listRoles() };
  }

  /** POST /api/rbac/roles — create a global role. 409 if the key exists. */
  @Post("roles")
  @RequirePermission("manage", "role")
  async createRole(@Body(ZodBody(createRoleSchema)) input: z.infer<typeof createRoleSchema>) {
    return { role: await this.service.createRole(input) };
  }

  /** POST /api/rbac/roles/:roleKey/permissions — grant `{action}:{resource}` to a role (204). */
  @Post("roles/:roleKey/permissions")
  @HttpCode(204)
  @RequirePermission("manage", "role")
  async grant(
    @Param("roleKey") roleKey: string,
    @Body(ZodBody(grantPermissionSchema)) body: z.infer<typeof grantPermissionSchema>,
  ) {
    await this.service.grantPermission(roleKey, body.action, body.resource);
  }

  /** DELETE /api/rbac/roles/:roleKey/permissions/:permissionKey — revoke one permission (204). */
  @Delete("roles/:roleKey/permissions/:permissionKey")
  @HttpCode(204)
  @RequirePermission("manage", "role")
  async revoke(
    @Param("roleKey") roleKey: string,
    @Param("permissionKey") permissionKey: string,
  ) {
    await this.service.revokePermission(roleKey, permissionKey);
  }

  /**
   * POST /api/rbac/assignments — give a user a role **in the caller's active
   * tenant** (204). The acting user is recorded as `granted_by`.
   */
  @Post("assignments")
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async assign(
    @Body(ZodBody(assignRoleSchema)) input: z.infer<typeof assignRoleSchema>,
    @CurrentUser() actor: Principal,
  ) {
    await this.service.assignRole(input.userId, input.roleKey, actor.userId);
  }

  /** DELETE /api/rbac/assignments/:userId/:roleKey — remove a role in the active tenant (204). */
  @Delete("assignments/:userId/:roleKey")
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async unassign(@Param("userId") userId: string, @Param("roleKey") roleKey: string) {
    await this.service.removeRole(userId, roleKey);
  }

  /** GET /api/rbac/users/:userId — that user's roles + effective permission keys, in the active tenant. */
  @Get("users/:userId")
  @RequirePermission("read", "role")
  async userRoles(@Param("userId") userId: string) {
    return {
      roles: await this.service.rolesForUser(userId),
      permissions: await this.service.permissionsForUser(userId),
    };
  }
}
