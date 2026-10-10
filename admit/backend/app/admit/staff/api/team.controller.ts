import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { TeamService } from "../application/team-service.js";

const passwordSchema = z.object({ newPassword: z.string().min(10, "The password must be at least 10 characters.").max(200) }).strict();

const addSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(200),
    roleKey: z.string().min(2).max(40),
    /** Present when the owner creates the account on the person's behalf. */
    account: z
      .object({
        name: z.string().trim().min(2, "Enter their full name.").max(120),
        password: z.string().min(10, "The starting password must be at least 10 characters.").max(200),
      })
      .strict()
      .optional(),
  })
  .strict();

@ApiTags("admit · team")
@ApiBearerAuth("access-token")
@Controller("admit/team")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Get()
  @RequirePermission("manage", "event_staff")
  overview(@CurrentUser() who: Principal) {
    return this.service.overview(who);
  }

  @Post()
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async add(@CurrentUser() who: Principal, @Body(ZodBody(addSchema)) b: z.infer<typeof addSchema>) {
    await this.service.add(who, b.email, b.roleKey, b.account);
  }

  @Post(":userId/password")
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async setPassword(@CurrentUser() who: Principal, @Param("userId") userId: string, @Body(ZodBody(passwordSchema)) b: z.infer<typeof passwordSchema>) {
    await this.service.setMemberPassword(who, userId, b.newPassword);
  }

  @Delete(":userId")
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async removeMember(@CurrentUser() who: Principal, @Param("userId") userId: string) {
    await this.service.removeMember(who, userId);
  }

  @Delete(":userId/roles/:roleKey")
  @HttpCode(204)
  @RequirePermission("assign", "role")
  async removeRole(@CurrentUser() who: Principal, @Param("userId") userId: string, @Param("roleKey") roleKey: string) {
    await this.service.removeRole(who, userId, roleKey);
  }
}
