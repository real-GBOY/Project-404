import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { TasksService } from "./tasks-service.js";
import {
  createTaskSchema,
  updateTaskStatusSchema,
  listTasksQuery,
  type CreateTaskBody,
  type UpdateTaskStatusBody,
  type ListTasksQuery,
} from "./tasks.schema.js";

@ApiTags("realestate · tasks")
@ApiBearerAuth("access-token")
@Controller("realestate/tasks")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @RequirePermission("read", "task")
  list(@Query(ZodQuery(listTasksQuery)) q: ListTasksQuery) {
    return this.service.list(q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "task")
  create(@Body(ZodBody(createTaskSchema)) body: CreateTaskBody) {
    return this.service.create(body);
  }

  @Patch(":id/status")
  @RequirePermission("update", "task")
  updateStatus(@Param("id") id: string, @Body(ZodBody(updateTaskStatusSchema)) body: UpdateTaskStatusBody) {
    return this.service.updateStatus(id, body.status);
  }
}
