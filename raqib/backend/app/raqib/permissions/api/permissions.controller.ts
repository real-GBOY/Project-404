import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { PermissionsService } from "../application/permissions-service.js";
import { applyTemplatesSchema, type ApplyTemplatesBody } from "../validation/permissions.schema.js";

@ApiTags("raqib · permission templates")
@ApiBearerAuth("access-token")
@Controller("raqib/permissions")
@UseGuards(JwtAuthGuard, AccessGuard)
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  @Allow("permissions", "V")
  overview(@Caller() who: Access) {
    return this.service.overview(who);
  }

  @Put()
  @Allow("permissions", "E")
  apply(@Body(ZodBody(applyTemplatesSchema)) b: ApplyTemplatesBody, @Caller() who: Access) {
    return this.service.apply(b.changes, b.reason, who);
  }
}
