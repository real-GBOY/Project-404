import { Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ValidationError } from "@core/kernel/errors.js";
import { createPrefixedId } from "@core/kernel/id.js";
import { BillingService } from "../application/billing-service.js";
import {
  collectPaymentSchema,
  postChargeSchema,
  voidChargeSchema,
  type CollectPaymentBody,
  type PostChargeBody,
  type VoidChargeBody,
} from "../validation/billing.schema.js";

const KEY = /^[A-Za-z0-9_-]{8,100}$/;

@ApiTags("hotel · billing")
@ApiBearerAuth("access-token")
@Controller("hotel")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("reservations/:id/folio")
  @RequirePermission("read", "folio")
  folio(@Param("id") id: string) {
    return this.billing.folio(id);
  }

  @Post("reservations/:id/charges")
  @HttpCode(201)
  @RequirePermission("post", "charge")
  postCharge(
    @Param("id") id: string,
    @Body(ZodBody(postChargeSchema)) body: PostChargeBody,
    @CurrentUser() user: Principal,
  ) {
    return this.billing.postCharge(id, body, user.userId);
  }

  @Post("charges/:id/void")
  @HttpCode(200)
  @RequirePermission("void", "charge")
  voidCharge(
    @Param("id") id: string,
    @Body(ZodBody(voidChargeSchema)) body: VoidChargeBody,
    @CurrentUser() user: Principal,
  ) {
    return this.billing.voidCharge(id, body.reason, user.userId);
  }

  /**
   * Clients send an `Idempotency-Key` (the app generates one per payment attempt) so a retried
   * request never charges twice. Without one the server generates a key — safe, just not
   * retry-proof.
   */
  @Post("reservations/:id/payments")
  @HttpCode(201)
  @RequirePermission("create", "payment")
  collect(
    @Param("id") id: string,
    @Body(ZodBody(collectPaymentSchema)) body: CollectPaymentBody,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentUser() user: Principal,
  ) {
    if (key !== undefined && !KEY.test(key)) {
      throw ValidationError(
        "payment.bad_idempotency_key",
        "Idempotency-Key must be 8–100 letters, digits, - or _.",
      );
    }
    return this.billing.collectPayment(
      id,
      { ...body, idempotencyKey: key ?? createPrefixedId("idem") },
      user.userId,
    );
  }

  @Get("invoices/:id")
  @RequirePermission("read", "invoice")
  invoice(@Param("id") id: string) {
    return this.billing.invoice(id);
  }
}
