import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { BuildingsService } from "./buildings-service.js";
import {
  createBuildingSchema,
  updateBuildingSchema,
  type CreateBuildingBody,
  type UpdateBuildingBody,
} from "./buildings.schema.js";

@ApiTags("realestate · buildings")
@ApiBearerAuth("access-token")
@Controller("realestate/buildings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BuildingsController {
  constructor(private readonly service: BuildingsService) {}

  @Get()
  @RequirePermission("read", "building")
  list(@Query("projectId") projectId: string) {
    return this.service.listForProject(projectId);
  }

  @Get(":id")
  @RequirePermission("read", "building")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "building")
  create(@Body(ZodBody(createBuildingSchema)) body: CreateBuildingBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "building")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateBuildingSchema)) body: UpdateBuildingBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }
}
