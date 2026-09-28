import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { MaintenanceService } from "../application/maintenance-service.js";
import type { TicketStatus } from "../domain/ticket-state.js";
import {
  assignSchema,
  costSchema,
  extendSchema,
  listTicketsQuery,
  noteSchema,
  notesSchema,
  reopenSchema,
  reportSchema,
  type ListTicketsQuery,
  type ReportBody,
} from "../validation/maintenance.schema.js";

@ApiTags("hotel · maintenance")
@ApiBearerAuth("access-token")
@Controller("hotel/maintenance/tickets")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @RequirePermission("read", "maintenance")
  async list(
    @Query(ZodQuery(listTicketsQuery)) q: ListTicketsQuery,
    @CurrentUser() user: Principal,
  ) {
    return {
      items: await this.service.list({
        status: q.status as TicketStatus | undefined,
        open: q.open,
        roomId: q.roomId,
        assigneeId: q.mine ? user.userId : undefined,
      }),
    };
  }

  @Get(":id")
  @RequirePermission("read", "maintenance")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "maintenance")
  report(@Body(ZodBody(reportSchema)) body: ReportBody, @CurrentUser() user: Principal) {
    return this.service.report(body, user.userId);
  }

  @Post(":id/assign")
  @HttpCode(200)
  @RequirePermission("manage", "maintenance")
  assign(
    @Param("id") id: string,
    @Body(ZodBody(assignSchema)) body: { assigneeId: string },
    @CurrentUser() user: Principal,
  ) {
    return this.service.assign(id, body.assigneeId, user.userId);
  }

  @Post(":id/start")
  @HttpCode(200)
  @RequirePermission("update", "maintenance")
  start(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.start(id, user.userId);
  }

  @Post(":id/resolve")
  @HttpCode(200)
  @RequirePermission("update", "maintenance")
  resolve(
    @Param("id") id: string,
    @Body(ZodBody(notesSchema)) body: { notes: string | null },
    @CurrentUser() user: Principal,
  ) {
    return this.service.resolve(id, body.notes, user.userId);
  }

  @Post(":id/reopen")
  @HttpCode(200)
  @RequirePermission("manage", "maintenance")
  reopen(
    @Param("id") id: string,
    @Body(ZodBody(reopenSchema)) body: { reason: string },
    @CurrentUser() user: Principal,
  ) {
    return this.service.reopen(id, body.reason, user.userId);
  }

  @Post(":id/verify")
  @HttpCode(200)
  @RequirePermission("manage", "maintenance")
  verify(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.verify(id, user.userId);
  }

  @Post(":id/notes")
  @HttpCode(201)
  @RequirePermission("update", "maintenance")
  note(
    @Param("id") id: string,
    @Body(ZodBody(noteSchema)) body: { body: string },
    @CurrentUser() user: Principal,
  ) {
    return this.service.addNote(id, body.body, user.userId);
  }

  @Post(":id/cost")
  @HttpCode(200)
  @RequirePermission("update", "maintenance")
  cost(
    @Param("id") id: string,
    @Body(ZodBody(costSchema)) body: { cost: number },
    @CurrentUser() user: Principal,
  ) {
    return this.service.setCost(id, body.cost, user.userId);
  }

  @Post(":id/extend-block")
  @HttpCode(200)
  @RequirePermission("manage", "maintenance")
  extend(
    @Param("id") id: string,
    @Body(ZodBody(extendSchema)) body: { expectedBack: string },
    @CurrentUser() user: Principal,
  ) {
    return this.service.extendBlock(id, body.expectedBack, user.userId);
  }
}
