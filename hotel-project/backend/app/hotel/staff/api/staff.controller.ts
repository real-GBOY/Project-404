import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { StaffService } from "../application/staff-service.js";
import {
  addStaffSchema,
  changeRoleSchema,
  type AddStaffBody,
  type ChangeRoleBody,
} from "../validation/staff.schema.js";

@ApiTags("hotel · staff")
@ApiBearerAuth("access-token")
@Controller("hotel")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StaffController {
  constructor(private readonly service: StaffService) {}

  /** Any signed-in staff member may read their own role (no extra permission). */
  @Get("me/role")
  myRole(@CurrentUser() user: Principal) {
    return this.service.myRole(user.userId);
  }

  @Get("staff")
  @RequirePermission("read", "staff")
  async list() {
    return { items: await this.service.list() };
  }

  @Get("roles")
  @RequirePermission("read", "staff")
  roles() {
    return this.service.roles();
  }

  @Post("staff")
  @HttpCode(201)
  @RequirePermission("manage", "staff")
  add(@Body(ZodBody(addStaffSchema)) body: AddStaffBody, @CurrentUser() user: Principal) {
    return this.service.add(body, user.userId);
  }

  @Put("staff/:userId/role")
  @RequirePermission("manage", "staff")
  changeRole(
    @Param("userId") userId: string,
    @Body(ZodBody(changeRoleSchema)) body: ChangeRoleBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.changeRole(userId, body.roleKey, user.userId);
  }

  @Post("staff/:userId/remove")
  @HttpCode(200)
  @RequirePermission("manage", "staff")
  remove(@Param("userId") userId: string, @CurrentUser() user: Principal) {
    return this.service.remove(userId, user.userId);
  }
}
