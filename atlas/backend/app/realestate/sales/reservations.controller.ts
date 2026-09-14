import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ReservationsService } from "./reservations-service.js";
import { createReservationSchema, type CreateReservationBody } from "./reservations.schema.js";
import type { ReservationStatus } from "./reservations-repository.js";

@ApiTags("realestate · reservations")
@ApiBearerAuth("access-token")
@Controller("realestate/reservations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Get()
  @RequirePermission("read", "reservation")
  list(@Query("status") status?: ReservationStatus) {
    return this.service.list(status);
  }

  @Get(":id")
  @RequirePermission("read", "reservation")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "reservation")
  create(@Body(ZodBody(createReservationSchema)) body: CreateReservationBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Post(":id/cancel")
  @RequirePermission("update", "reservation")
  cancel(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.cancel(id, user.userId);
  }
}
