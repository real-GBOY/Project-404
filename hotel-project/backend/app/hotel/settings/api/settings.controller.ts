import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { SettingsService } from "../application/settings-service.js";
import { updateSettingsSchema, type UpdateSettingsBody } from "../validation/settings.schema.js";

@ApiTags("hotel · settings")
@ApiBearerAuth("access-token")
@Controller("hotel/settings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @RequirePermission("read", "hotel_settings")
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission("update", "hotel_settings")
  update(
    @Body(ZodBody(updateSettingsSchema)) body: UpdateSettingsBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(body, user.userId);
  }
}
