import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { HousekeepingService } from "../application/housekeeping-service.js";
import type { TaskStatus } from "../domain/task-state.js";
import {
  assignSchema,
  completeSchema,
  createTaskSchema,
  listTasksQuery,
  type AssignBody,
  type CompleteBody,
  type CreateTaskBody,
  type ListTasksQuery,
} from "../validation/housekeeping.schema.js";

@ApiTags("hotel · housekeeping")
@ApiBearerAuth("access-token")
@Controller("hotel/housekeeping/tasks")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class HousekeepingController {
  constructor(private readonly service: HousekeepingService) {}

  @Get()
  @RequirePermission("read", "housekeeping")
  async list(@Query(ZodQuery(listTasksQuery)) q: ListTasksQuery, @CurrentUser() user: Principal) {
    return {
      items: await this.service.list({
        status: q.status as TaskStatus | undefined,
        open: q.open,
        assigneeId: q.mine ? user.userId : undefined,
      }),
    };
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("manage", "housekeeping")
  create(@Body(ZodBody(createTaskSchema)) body: CreateTaskBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Post(":id/assign")
  @HttpCode(200)
  @RequirePermission("manage", "housekeeping")
  assign(
    @Param("id") id: string,
    @Body(ZodBody(assignSchema)) body: AssignBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.assign(id, body.assigneeId, user.userId);
  }

  @Post(":id/start")
  @HttpCode(200)
  @RequirePermission("update", "housekeeping")
  start(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.start(id, user.userId);
  }

  @Post(":id/complete")
  @HttpCode(200)
  @RequirePermission("update", "housekeeping")
  complete(
    @Param("id") id: string,
    @Body(ZodBody(completeSchema)) body: CompleteBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.complete(id, body.notes, user.userId);
  }

  @Post(":id/inspect")
  @HttpCode(200)
  @RequirePermission("manage", "housekeeping")
  inspect(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.inspect(id, user.userId);
  }
}
