import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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
  type CancelVisitBody,
  type CreateVisitBody,
  type ListVisitsQuery,
  type RescheduleVisitBody,
} from "../validation/visits.schema.js";

@ApiTags("raqib · visits")
@ApiBearerAuth("access-token")
@Controller("raqib/visits")
@UseGuards(JwtAuthGuard, AccessGuard)
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get()
  @Allow("visits", "V")
  async list(@Query(ZodQuery(listVisitsQuery)) q: ListVisitsQuery, @Caller() who: Access) {
    return { items: await this.service.list(who, q) };
  }

  /** Inspectors a visit in this project can be assigned to (people who schedule need this, not the full user list). */
  @Get("inspectors/eligible")
  @Allow("visits", "A")
  async inspectors(@Query("projectId") projectId: string, @Query("date") date: string | undefined, @Caller() who: Access) {
    return { items: await this.service.eligibleInspectors(projectId, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : who.today, who) };
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
