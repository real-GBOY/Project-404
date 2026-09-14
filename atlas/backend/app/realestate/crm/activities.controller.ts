import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { ActivitiesService } from "./activities-service.js";
import {
  createActivitySchema,
  listActivitiesQuery,
  type CreateActivityBody,
  type ListActivitiesQuery,
} from "./activities.schema.js";

@ApiTags("realestate · activities")
@ApiBearerAuth("access-token")
@Controller("realestate/activities")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @RequirePermission("read", "activity")
  list(@Query(ZodQuery(listActivitiesQuery)) q: ListActivitiesQuery) {
    return this.service.list(q.relatedType, q.relatedId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "activity")
  create(@Body(ZodBody(createActivitySchema)) body: CreateActivityBody) {
    return this.service.create(body);
  }
}
