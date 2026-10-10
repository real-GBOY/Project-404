import { Body, Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { StaffService } from "../application/staff-service.js";

const assignSchema = z.object({ gate: z.string().trim().max(40).default("") }).strict();

@ApiTags("admit · event staff")
@ApiBearerAuth("access-token")
@Controller("admit/events/:eventId/staff")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @RequirePermission("manage", "event_staff")
  async list(@CurrentUser() who: Principal, @Param("eventId") eventId: string) {
    return { items: await this.service.list(who, eventId) };
  }

  @Put(":userId")
  @RequirePermission("manage", "event_staff")
  async assign(
    @CurrentUser() who: Principal,
    @Param("eventId") eventId: string,
    @Param("userId") userId: string,
    @Body(ZodBody(assignSchema)) b: z.infer<typeof assignSchema>,
  ) {
    return { items: await this.service.assign(who, eventId, userId, b.gate) };
  }

  @Delete(":userId")
  @HttpCode(204)
  @RequirePermission("manage", "event_staff")
  async remove(@CurrentUser() who: Principal, @Param("eventId") eventId: string, @Param("userId") userId: string) {
    await this.service.remove(who, eventId, userId);
  }
}
