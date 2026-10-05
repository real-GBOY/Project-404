import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { SettingsService } from "../application/settings-service.js";
import { updateSettingsSchema, type UpdateSettingsBody } from "../validation/settings.schema.js";
import type { OrgSettings } from "../domain/defaults.js";

@ApiTags("raqib · settings")
@ApiBearerAuth("access-token")
@Controller("raqib/settings")
@UseGuards(JwtAuthGuard, AccessGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @Allow("settings", "V")
  get() {
    return this.service.current();
  }

  @Put()
  @Allow("settings", "E")
  update(@Body(ZodBody(updateSettingsSchema)) body: UpdateSettingsBody, @Caller() who: Access) {
    return this.service.update(body.settings as OrgSettings, body.reason, who.userId);
  }
}
