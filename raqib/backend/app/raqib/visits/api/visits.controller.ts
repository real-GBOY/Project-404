import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { VisitsService } from "../application/visits-service.js";
import {
  cancelVisitSchema,
  createVisitSchema,
  listVisitsQuery,
  rescheduleVisitSchema,
  scheduleQuery,
  type CancelVisitBody,
  type CreateVisitBody,
  type ListVisitsQuery,
  type RescheduleVisitBody,
  type ScheduleQuery,
} from "../validation/visits.schema.js";
import { parsePage, toPage } from "@raqib/raqib/shared/paging.js";

@ApiTags("raqib · visits")
@ApiBearerAuth("access-token")
@Controller("raqib/visits")
@UseGuards(JwtAuthGuard, AccessGuard)
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get()
  @Allow("visits", "V")
  async list(@Query(ZodQuery(listVisitsQuery)) q: ListVisitsQuery, @Caller() who: Access) {
    const { limit, cursor, ...filter } = q;
    const page = parsePage({ limit, cursor });
    return toPage(await this.service.list(who, filter, page), page);
  }

  /** Inspectors a visit in this project can be assigned to (people who schedule need this, not the full user list). */
  @Get("inspectors/eligible")
  @Allow("visits", "A")
  async inspectors(@Query("projectId") projectId: string, @Query("date") date: string | undefined, @Caller() who: Access) {
    return { items: await this.service.eligibleInspectors(projectId, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : who.today, who) };
  }

  /** The schedule for a period as CSV (`from`, `to`, optional `projectId`, `inspectorId`, `lang`). */
  @Get("export")
  @Allow("visits", "X")
  async exportCsv(@Query(ZodQuery(scheduleQuery)) q: ScheduleQuery, @Caller() who: Access, @Res() reply: FastifyReply) {
    const { lang, ...filter } = q;
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="raqib-schedule.csv"')
      .header("Cache-Control", "private, no-store")
      .send(await this.service.scheduleCsv(who, filter, lang));
  }

  /** The schedule for a period as a print-ready A4 page, grouped by inspector. */
  @Get("print")
  @Allow("visits", "D")
  async print(@Query(ZodQuery(scheduleQuery)) q: ScheduleQuery, @Caller() who: Access, @Res() reply: FastifyReply) {
    const { lang, ...filter } = q;
    reply
      .header("Content-Type", "text/html; charset=utf-8")
      .header("Cache-Control", "private, no-store")
      .send(await this.service.schedulePrint(who, filter, lang));
  }

  @Get("forms/available")
  @Allow("visits", "A")
  async availableForms(@Caller() who: Access) {
    return { items: await this.service.availableForms(who) };
  }

  /** The organization's configured shifts (names and hours, not the scheduling rules) - what a schedule picker offers. */
  @Get("shifts")
  @Allow("visits", "V")
  async shifts() {
    return { items: await this.service.shifts() };
  }

  @Get(":id")
  @Allow("visits", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  @Post()
  @HttpCode(201)
  @Allow("visits", "A")
  create(@Body(ZodBody(createVisitSchema)) b: CreateVisitBody, @Caller() who: Access) {
    return this.service.create(b, who);
  }

  @Post(":id/reschedule")
  @HttpCode(200)
  @Allow("visits", "A")
  reschedule(@Param("id") id: string, @Body(ZodBody(rescheduleVisitSchema)) b: RescheduleVisitBody, @Caller() who: Access) {
    return this.service.reschedule(id, b, who);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @Allow("visits", "A")
  cancel(@Param("id") id: string, @Body(ZodBody(cancelVisitSchema)) b: CancelVisitBody, @Caller() who: Access) {
    return this.service.cancel(id, b.reason, who);
  }
}
