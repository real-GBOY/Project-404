import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { SettingsService, settingsPatchSchema, type SettingsPatch } from "../application/settings-service.js";

/** Who is signed in and what they can reach: everything the dashboard needs to draw its shell, from the server. */
@ApiTags("admit · me")
@ApiBearerAuth("access-token")
@Controller("admit/me")
@UseGuards(JwtAuthGuard)
export class AdmitMeController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@CurrentUser() who: Principal) {
    return this.service.me(who);
  }
}

@ApiTags("admit · settings")
@ApiBearerAuth("access-token")
@Controller("admit/settings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @RequirePermission("read", "admit_settings")
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission("update", "admit_settings")
  update(@CurrentUser() who: Principal, @Body(ZodBody(settingsPatchSchema)) b: SettingsPatch) {
    return this.service.update(who.userId, b);
  }
}
