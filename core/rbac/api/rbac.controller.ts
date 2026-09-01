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
import { JwtAuthGuard } from "../../http/jwt-auth.guard.js";
import { PermissionGuard } from "../../http/permission.guard.js";
import { RequirePermission, CurrentUser } from "../../http/decorators.js";
import { ZodBody } from "../../http/zod.pipe.js";
import type { Principal } from "../../http/principal.js";
import { RbacService } from "../application/rbac-service.js";
import {
  assignRoleSchema,
  createRoleSchema,
  grantPermissionSchema,
} from "../validation/schemas.js";
import type { z } from "zod";

@Controller("rbac")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacController {
  constructor(private readonly service: RbacService) {}

  @Get("roles")
  @RequirePermission("read", "role")
  async listRoles() {
    return { roles: await this.service.listRoles() };
  }

  @Post("roles")
  @RequirePermission("manage", "role")
  async createRole(@Body(ZodBody(createRoleSchema)) input: z.infer<typeof createRoleSchema>) {
    return { role: await this.service.createRole(input) };
  }

  @Post("roles/:roleKey/permissions")
  @HttpCode(204)
  @RequirePermission("manage", "role")
  async grant(
    @Param("roleKey") roleKey: string,
    @Body(ZodBody(grantPermissionSchema)) body: z.infer<typeof grantPermissionSchema>,
  ) {
    await this.service.grantPermission(roleKey, body.action, body.resource);
  }

  @Delete("roles/:roleKey/permissions/:permissionKey")
  @HttpCode(204)
  @RequirePermission("manage", "role")
  async revoke(
    @Param("roleKey") roleKey: string,
    @Param("permissionKey") permissionKey: string,
  ) {
    await this.service.revokePermission(roleKey, permissionKey);
  }

  @Post("assignments")
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async assign(
    @Body(ZodBody(assignRoleSchema)) input: z.infer<typeof assignRoleSchema>,
    @CurrentUser() actor: Principal,
  ) {
    await this.service.assignRole(input.userId, input.roleKey, actor.userId);
  }

  @Delete("assignments/:userId/:roleKey")
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async unassign(@Param("userId") userId: string, @Param("roleKey") roleKey: string) {
    await this.service.removeRole(userId, roleKey);
  }

  @Get("users/:userId")
  @RequirePermission("read", "role")
  async userRoles(@Param("userId") userId: string) {
    return {
      roles: await this.service.rolesForUser(userId),
      permissions: await this.service.permissionsForUser(userId),
    };
  }
}
