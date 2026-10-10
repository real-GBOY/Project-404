import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { EventsService } from "../application/events-service.js";
import {
  createEventSchema,
  paymentMethodPatchSchema,
  paymentMethodSchema,
  ticketTypePatchSchema,
  ticketTypeSchema,
  updateEventSchema,
  venuePatchSchema,
  venueSchema,
  type CreateEventBody,
  type PaymentMethodBody,
  type PaymentMethodPatchBody,
  type TicketTypeBody,
  type TicketTypePatchBody,
  type UpdateEventBody,
  type VenueBody,
  type VenuePatchBody,
} from "../validation/events.schema.js";

@ApiTags("admit · events")
@ApiBearerAuth("access-token")
@Controller("admit")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EventsController {
  constructor(private readonly service: EventsService) {}

  // Reads need `read:event`; the service then narrows to the events the caller works (see EventAccess).
  @Get("events")
  @RequirePermission("read", "event")
  async list(@CurrentUser() who: Principal) {
    return { items: await this.service.list(who) };
  }

  @Get("events/:id")
  @RequirePermission("read", "event")
  get(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.get(who, id);
  }

  @Post("events")
  @HttpCode(201)
  @RequirePermission("create", "event")
  create(@CurrentUser() who: Principal, @Body(ZodBody(createEventSchema)) b: CreateEventBody) {
    return this.service.create(who, b);
  }

  @Patch("events/:id")
  @RequirePermission("update", "event")
  update(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(updateEventSchema)) b: UpdateEventBody) {
    return this.service.update(who, id, b);
  }

  @Delete("events/:id")
  @HttpCode(204)
  @RequirePermission("update", "event")
  async remove(@CurrentUser() who: Principal, @Param("id") id: string) {
    await this.service.remove(who, id);
  }

  @Post("events/:id/publish")
  @HttpCode(200)
  @RequirePermission("publish", "event")
  publish(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.publish(who, id);
  }

  @Post("events/:id/unpublish")
  @HttpCode(200)
  @RequirePermission("publish", "event")
  unpublish(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.unpublish(who, id);
  }

  @Post("events/:id/cancel")
  @HttpCode(200)
  @RequirePermission("publish", "event")
  cancel(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.cancel(who, id);
  }

  @Post("events/:id/archive")
  @HttpCode(200)
  @RequirePermission("publish", "event")
  archive(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.archive(who, id);
  }

  // ---- venues ---------------------------------------------------------------------------------
  @Get("venues")
  @RequirePermission("read", "event")
  async venues() {
    return { items: await this.service.venues() };
  }

  @Post("venues")
  @HttpCode(201)
  @RequirePermission("create", "event")
  createVenue(@CurrentUser() who: Principal, @Body(ZodBody(venueSchema)) b: VenueBody) {
    return this.service.createVenue(who, b);
  }

  @Get("venues/:id")
  @RequirePermission("read", "event")
  venue(@Param("id") id: string) {
    return this.service.getVenue(id);
  }

  @Delete("venues/:id")
  @HttpCode(204)
  @RequirePermission("update", "event")
  async deleteVenue(@CurrentUser() who: Principal, @Param("id") id: string) {
    await this.service.deleteVenue(who, id);
  }

  @Patch("venues/:id")
  @RequirePermission("update", "event")
  updateVenue(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(venuePatchSchema)) b: VenuePatchBody) {
    return this.service.updateVenue(who, id, b);
  }

  // ---- ticket types ---------------------------------------------------------------------------
  @Post("events/:id/ticket-types")
  @HttpCode(201)
  @RequirePermission("manage", "ticket_type")
  createType(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(ticketTypeSchema)) b: TicketTypeBody) {
    return this.service.createType(who, id, b);
  }

  @Patch("ticket-types/:id")
  @RequirePermission("manage", "ticket_type")
  updateType(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(ticketTypePatchSchema)) b: TicketTypePatchBody) {
    return this.service.updateType(who, id, b);
  }

  @Delete("ticket-types/:id")
  @HttpCode(204)
  @RequirePermission("manage", "ticket_type")
  async deleteType(@CurrentUser() who: Principal, @Param("id") id: string) {
    await this.service.deleteType(who, id);
  }

  // ---- payment methods ------------------------------------------------------------------------
  @Post("events/:id/payment-methods")
  @HttpCode(201)
  @RequirePermission("manage", "payment_method")
  createMethod(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(paymentMethodSchema)) b: PaymentMethodBody) {
    return this.service.createMethod(who, id, b);
  }

  @Patch("payment-methods/:id")
  @RequirePermission("manage", "payment_method")
  updateMethod(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(paymentMethodPatchSchema)) b: PaymentMethodPatchBody) {
    return this.service.updateMethod(who, id, b);
  }

  @Delete("payment-methods/:id")
  @HttpCode(204)
  @RequirePermission("manage", "payment_method")
  async deleteMethod(@CurrentUser() who: Principal, @Param("id") id: string) {
    await this.service.deleteMethod(who, id);
  }
}
