import { Body, Controller, Get, HttpCode, Patch, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { PriceListsService } from "./price-lists-service.js";
import {
  createPriceListSchema,
  updatePriceListSchema,
  type CreatePriceListBody,
  type UpdatePriceListBody,
} from "./price-lists.schema.js";

@ApiTags("realestate · price lists")
@ApiBearerAuth("access-token")
@Controller("realestate/price-lists")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PriceListsController {
  constructor(private readonly service: PriceListsService) {}

  @Get()
  @RequirePermission("read", "price_list")
  list(@Query("projectId") projectId: string) {
    return this.service.listForProject(projectId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "price_list")
  create(@Body(ZodBody(createPriceListSchema)) body: CreatePriceListBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "price_list")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updatePriceListSchema)) body: UpdatePriceListBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }
}
