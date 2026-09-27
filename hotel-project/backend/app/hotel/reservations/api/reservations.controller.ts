import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { AvailabilityService } from "../application/availability-service.js";
import { ReservationsService } from "../application/reservations-service.js";
import type { ReservationStatus } from "../domain/reservation-state.js";
import {
  availabilityQuery,
  calendarQuery,
  cancelSchema,
  changeDatesSchema,
  changeRoomSchema,
  createReservationSchema,
  freeRoomsQuery,
  listReservationsQuery,
  type AvailabilityQuery,
  type CalendarQuery,
  type CancelBody,
  type ChangeDatesBody,
  type ChangeRoomBody,
  type CreateReservationBody,
  type FreeRoomsQuery,
  type ListReservationsQuery,
} from "../validation/reservations.schema.js";

/**
 * Reservations are changed only through explicit domain actions (confirm, cancel, no-show,
 * change-room, change-dates) — there is no generic PATCH that could set a status or a price.
 */
@ApiTags("hotel · reservations")
@ApiBearerAuth("access-token")
@Controller("hotel")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get("availability")
  @RequirePermission("read", "reservation")
  search(@Query(ZodQuery(availabilityQuery)) q: AvailabilityQuery) {
    return this.availability.search(q);
  }

  @Get("availability/rooms")
  @RequirePermission("read", "reservation")
  async freeRooms(@Query(ZodQuery(freeRoomsQuery)) q: FreeRoomsQuery) {
    return { items: await this.availability.freeRooms(q.roomTypeId, q.arrival, q.departure) };
  }

  @Get("calendar")
  @RequirePermission("read", "reservation")
  calendar(@Query(ZodQuery(calendarQuery)) q: CalendarQuery) {
    return this.availability.calendar(q.from, q.days);
  }

  @Get("reservations")
  @RequirePermission("read", "reservation")
  list(@Query(ZodQuery(listReservationsQuery)) q: ListReservationsQuery) {
    return this.reservations.list({ ...q, status: q.status as ReservationStatus | undefined });
  }

  @Get("reservations/:id")
  @RequirePermission("read", "reservation")
  get(@Param("id") id: string) {
    return this.reservations.get(id);
  }

  @Post("reservations")
  @HttpCode(201)
  @RequirePermission("create", "reservation")
  create(
    @Body(ZodBody(createReservationSchema)) body: CreateReservationBody,
    @CurrentUser() user: Principal,
  ) {
    return this.reservations.create(body, user.userId);
  }

  @Post("reservations/:id/confirm")
  @HttpCode(200)
  @RequirePermission("update", "reservation")
  confirm(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.reservations.confirm(id, user.userId);
  }

  @Post("reservations/:id/cancel")
  @HttpCode(200)
  @RequirePermission("cancel", "reservation")
  cancel(
    @Param("id") id: string,
    @Body(ZodBody(cancelSchema)) body: CancelBody,
    @CurrentUser() user: Principal,
  ) {
    return this.reservations.cancel(id, body.reason ?? null, user.userId);
  }

  @Post("reservations/:id/no-show")
  @HttpCode(200)
  @RequirePermission("update", "reservation")
  noShow(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.reservations.noShow(id, user.userId);
  }

  @Post("reservations/:id/change-room")
  @HttpCode(200)
  @RequirePermission("update", "reservation")
  changeRoom(
    @Param("id") id: string,
    @Body(ZodBody(changeRoomSchema)) body: ChangeRoomBody,
    @CurrentUser() user: Principal,
  ) {
    return this.reservations.changeRoom(id, body.roomId, user.userId);
  }

  @Post("reservations/:id/change-dates")
  @HttpCode(200)
  @RequirePermission("update", "reservation")
  changeDates(
    @Param("id") id: string,
    @Body(ZodBody(changeDatesSchema)) body: ChangeDatesBody,
    @CurrentUser() user: Principal,
  ) {
    return this.reservations.changeDates(id, body.arrival, body.departure, user.userId);
  }
}
