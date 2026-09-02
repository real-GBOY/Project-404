import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { TasksService } from "./tasks-service.js";

const priority = z.enum(["low", "normal", "high"]);
const status = z.enum(["todo", "in_progress", "done"]);
const listQuery = z.object({
  mine: z.coerce.boolean().optional(),
  matterId: z.string().optional(),
  status: status.optional(),
  range: z.enum(["today", "week", "overdue", "all"]).optional(),
});
const createSchema = z.object({
  title: z.string().trim().min(1).max(300),
  matterId: z.string().nullish(),
  assigneeId: z.string().nullish(),
  priority: priority.optional(),
  dueAt: z.string().nullish(),
});
const updateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  priority: priority.optional(),
  dueAt: z.string().nullish(),
  status: status.optional(),
  assigneeId: z.string().nullish(),
});
const assignSchema = z.object({ assigneeId: z.string().nullable() });

@Controller("tasks")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get("summary")
  @RequirePermission("read", "task")
  summary() {
    return this.service.summary();
  }

  @Get()
  @RequirePermission("read", "task")
  list(@Query(ZodQuery(listQuery)) q: z.infer<typeof listQuery>, @CurrentUser() user: Principal) {
    return this.service.list({ ...q, actorId: user.userId });
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "task")
  create(@Body(ZodBody(createSchema)) body: z.infer<typeof createSchema>, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "task")
  update(@Param("id") id: string, @Body(ZodBody(updateSchema)) body: z.infer<typeof updateSchema>) {
    return this.service.update(id, body);
  }

  @Post(":id/complete")
  @RequirePermission("complete", "task")
  complete(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.toggleComplete(id, user.userId);
  }

  @Post(":id/assign")
  @RequirePermission("assign", "task")
  assign(@Param("id") id: string, @Body(ZodBody(assignSchema)) body: z.infer<typeof assignSchema>) {
    return this.service.assign(id, body.assigneeId);
  }
}
