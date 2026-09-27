import { Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { createPrefixedId } from "@core/kernel/id.js";
import { FrontDeskService } from "../application/front-desk-service.js";
import {
  checkInSchema,
  checkOutSchema,
  extendSchema,
  type CheckInBody,
  type CheckOutBody,
  type ExtendBody,
} from "../validation/front-desk.schema.js";

@ApiTags("hotel · front desk")
@ApiBearerAuth("access-token")
@Controller("hotel")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FrontDeskController {
  constructor(private readonly desk: FrontDeskService) {}

  @Get("front-desk/today")
  @RequirePermission("read", "reservation")
  today() {
    return this.desk.today();
  }

  @Post("reservations/:id/check-in")
  @HttpCode(200)
  @RequirePermission("check_in", "reservation")
  checkIn(
    @Param("id") id: string,
    @Body(ZodBody(checkInSchema)) body: CheckInBody,
    @CurrentUser() user: Principal,
  ) {
    return this.desk.checkIn(id, { roomId: body.roomId ?? null }, user.userId);
  }

  @Post("reservations/:id/check-out")
  @HttpCode(200)
  @RequirePermission("check_out", "reservation")
  checkOut(
    @Param("id") id: string,
    @Body(ZodBody(checkOutSchema)) body: CheckOutBody,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentUser() user: Principal,
  ) {
    return this.desk.checkOut(
      id,
      {
        payment: body.payment
          ? { ...body.payment, idempotencyKey: key ?? createPrefixedId("idem") }
          : null,
      },
      user.userId,
    );
  }

  @Post("reservations/:id/extend")
  @HttpCode(200)
  @RequirePermission("update", "reservation")
  extend(
    @Param("id") id: string,
    @Body(ZodBody(extendSchema)) body: ExtendBody,
    @CurrentUser() user: Principal,
  ) {
    return this.desk.extendStay(id, body.departure, user.userId);
  }
}
