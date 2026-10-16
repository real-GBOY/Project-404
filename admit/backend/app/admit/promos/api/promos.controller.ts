import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { PromosService } from "../application/promos-service.js";
import { createPromoSchema, updatePromoSchema, type CreatePromoBody, type UpdatePromoBody } from "../validation/promos.schema.js";

@ApiTags("admit · promo codes")
@ApiBearerAuth("access-token")
@Controller("admit")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PromosController {
  constructor(private readonly service: PromosService) {}

  @Get("events/:id/promo-codes")
  @RequirePermission("read", "event")
  async list(@CurrentUser() who: Principal, @Param("id") id: string) {
    return { items: await this.service.list(who, id) };
  }

  @Post("events/:id/promo-codes")
  @HttpCode(201)
  @RequirePermission("update", "event")
  create(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(createPromoSchema)) b: CreatePromoBody) {
    return this.service.create(who, id, b);
  }

  @Patch("promo-codes/:id")
  @RequirePermission("update", "event")
  update(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(updatePromoSchema)) b: UpdatePromoBody) {
    return this.service.update(who, id, b);
  }

  @Delete("promo-codes/:id")
  @HttpCode(204)
  @RequirePermission("update", "event")
  async remove(@CurrentUser() who: Principal, @Param("id") id: string) {
    await this.service.remove(who, id);
  }
}
