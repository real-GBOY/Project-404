import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { PricingService } from "../application/pricing-service.js";
import {
  createDiscountSchema,
  createRateRuleSchema,
  type CreateDiscountBody,
  type CreateRateRuleBody,
} from "../validation/pricing.schema.js";

@ApiTags("hotel · pricing")
@ApiBearerAuth("access-token")
@Controller("hotel/rates")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get()
  @RequirePermission("read", "rate")
  list() {
    return this.service.list();
  }

  @Post("rules")
  @HttpCode(201)
  @RequirePermission("manage", "rate")
  createRule(
    @Body(ZodBody(createRateRuleSchema)) body: CreateRateRuleBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.createRule(body, user.userId);
  }

  @Post("rules/:id/archive")
  @HttpCode(200)
  @RequirePermission("manage", "rate")
  archiveRule(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.archiveRule(id, user.userId);
  }

  @Post("discounts")
  @HttpCode(201)
  @RequirePermission("manage", "rate")
  createDiscount(
    @Body(ZodBody(createDiscountSchema)) body: CreateDiscountBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.createDiscount(body, user.userId);
  }

  @Post("discounts/:id/archive")
  @HttpCode(200)
  @RequirePermission("manage", "rate")
  archiveDiscount(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.archiveDiscount(id, user.userId);
  }
}
