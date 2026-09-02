import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { CalendarService } from "./calendar-service.js";

const rangeQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  lawyerId: z.string().optional(),
});
const createEvent = z.object({
  title: z.string().trim().min(1).max(300),
  kind: z.enum(["meeting", "reminder", "court_filing", "other"]).optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullish(),
  matterId: z.string().nullish(),
});
const updateEvent = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  kind: z.enum(["meeting", "reminder", "court_filing", "other"]).optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullish(),
});

@Controller("calendar")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get()
  @RequirePermission("read", "calendar")
  range(@Query(ZodQuery(rangeQuery)) q: z.infer<typeof rangeQuery>) {
    return this.service.range(q);
  }

  @Post("events")
  @HttpCode(201)
  @RequirePermission("create", "event")
  create(@Body(ZodBody(createEvent)) body: z.infer<typeof createEvent>, @CurrentUser() user: Principal) {
    return this.service.createEvent(body, user.userId);
  }

  @Patch("events/:id")
  @RequirePermission("update", "event")
  update(@Param("id") id: string, @Body(ZodBody(updateEvent)) body: z.infer<typeof updateEvent>) {
    return this.service.updateEvent(id, body);
  }

  @Delete("events/:id")
  @HttpCode(204)
  @RequirePermission("delete", "event")
  async remove(@Param("id") id: string) {
    await this.service.deleteEvent(id);
  }
}
