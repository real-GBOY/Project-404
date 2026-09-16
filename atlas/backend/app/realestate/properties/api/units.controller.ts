import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { UnitsService } from "../application/units-service.js";
import {
  listUnitsQuery,
  updateUnitStatusSchema,
  type ListUnitsQuery,
  type UpdateUnitStatusBody,
} from "../validation/units.schema.js";

@ApiTags("realestate · units")
@ApiBearerAuth("access-token")
@Controller("realestate/units")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  @RequirePermission("read", "unit")
  list(@Query(ZodQuery(listUnitsQuery)) q: ListUnitsQuery) {
    return this.service.list(q);
  }

  @Get("availability")
  @RequirePermission("read", "unit")
  availability() {
    return this.service.availability();
  }

  @Get(":id")
  @RequirePermission("read", "unit")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post("buildings/:buildingId/generate")
  @RequirePermission("update", "unit")
  generate(@Param("buildingId") buildingId: string, @CurrentUser() user: Principal) {
    return this.service.generateForBuilding(buildingId, user.userId);
  }

  @Patch(":id/status")
  @RequirePermission("update", "unit")
  updateStatus(
    @Param("id") id: string,
    @Body(ZodBody(updateUnitStatusSchema)) body: UpdateUnitStatusBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.updateStatus(id, body, user.userId);
  }
}
