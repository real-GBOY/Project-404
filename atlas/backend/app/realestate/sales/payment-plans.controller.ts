import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { PaymentPlansService } from "./payment-plans-service.js";
import { createPaymentPlanSchema, type CreatePaymentPlanBody } from "./payment-plans.schema.js";

@ApiTags("realestate · payment plans")
@ApiBearerAuth("access-token")
@Controller("realestate/payment-plans")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentPlansController {
  constructor(private readonly service: PaymentPlansService) {}

  @Get(":id")
  @RequirePermission("read", "payment_plan")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Get("by-contract/:contractId")
  @RequirePermission("read", "payment_plan")
  getForContract(@Param("contractId") contractId: string) {
    return this.service.getForContract(contractId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "payment_plan")
  create(@Body(ZodBody(createPaymentPlanSchema)) body: CreatePaymentPlanBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }
}
