import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { BookingsService } from "../application/bookings-service.js";
import { cancelBookingSchema, listBookingsQuery, type CancelBookingBody, type ListBookingsQuery } from "../validation/bookings.schema.js";

const customersQuery = z.object({ search: z.string().trim().max(80).optional(), limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0) });

@ApiTags("admit · bookings")
@ApiBearerAuth("access-token")
@Controller("admit/bookings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get()
  @RequirePermission("read", "booking")
  list(@CurrentUser() who: Principal, @Query(ZodQuery(listBookingsQuery)) q: ListBookingsQuery) {
    return this.service.list(who, q);
  }

  @Get("customers/list")
  @RequirePermission("read", "booking")
  customers(@CurrentUser() who: Principal, @Query(ZodQuery(customersQuery)) q: z.infer<typeof customersQuery>) {
    return this.service.customers(who, q);
  }

  @Get(":id")
  @RequirePermission("read", "booking")
  detail(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.detail(who, id);
  }

  @Post(":id/cancel")
  @HttpCode(204)
  @RequirePermission("cancel", "booking")
  async cancel(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(cancelBookingSchema)) b: CancelBookingBody) {
    await this.service.cancelByOrganizer(who, id, b.reason);
  }
}
