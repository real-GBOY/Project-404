import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { SettingsService } from "./settings-service.js";
import { updateSettingsSchema, type UpdateSettingsInput } from "./settings.schema.js";

/** GET/PATCH /api/lawfirm/settings — the firm profile screen. */
@Controller("lawfirm/settings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @RequirePermission("read", "lawfirm_setting")
  async get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission("manage", "lawfirm_setting")
  async update(
    @Body(ZodBody(updateSettingsSchema)) body: UpdateSettingsInput,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(body, user.userId);
  }
}
