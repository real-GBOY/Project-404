import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { MattersService } from "./matters-service.js";
import {
  addParticipantSchema,
  addUpdateSchema,
  createMatterSchema,
  listMattersQuery,
  noteBodySchema,
  updateMatterSchema,
  type CreateMatterBody,
  type ListMattersQuery,
  type UpdateMatterBody,
} from "./matters.schema.js";

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MattersController {
  constructor(private readonly service: MattersService) {}

  @Get("casework/summary")
  @RequirePermission("read", "matter")
  caseworkSummary() {
    return this.service.caseworkSummary();
  }

  @Get("matters/form-options")
  @RequirePermission("read", "matter")
  formOptions() {
    return this.service.formOptions();
  }

  @Get("matters")
  @RequirePermission("read", "matter")
  list(@Query(ZodQuery(listMattersQuery)) q: ListMattersQuery) {
    return this.service.list(q);
  }

  @Post("matters")
  @HttpCode(201)
  @RequirePermission("create", "matter")
  create(
    @Body(ZodBody(createMatterSchema)) body: CreateMatterBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.create(body, user.userId);
  }

  @Get("matters/:id")
  @RequirePermission("read", "matter")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch("matters/:id")
  @RequirePermission("update", "matter")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateMatterSchema)) body: UpdateMatterBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }

  @Post("matters/:id/close")
  @RequirePermission("close", "matter")
  close(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.close(id, user.userId);
  }

  @Get("matters/:id/participants")
  @RequirePermission("read", "matter")
  participants(@Param("id") id: string) {
    return this.service.participants(id);
  }

  @Post("matters/:id/participants")
  @HttpCode(201)
  @RequirePermission("assign", "matter")
  addParticipant(
    @Param("id") id: string,
    @Body(ZodBody(addParticipantSchema)) body: { userId: string; role: string },
    @CurrentUser() user: Principal,
  ) {
    return this.service.addParticipant(id, body.userId, body.role, user.userId);
  }

  @Delete("matters/:id/participants/:pid")
  @HttpCode(204)
  @RequirePermission("assign", "matter")
  async removeParticipant(@Param("id") id: string, @Param("pid") pid: string) {
    await this.service.removeParticipant(id, pid);
  }

  @Get("matters/:id/updates")
  @RequirePermission("read", "matter")
  updates(@Param("id") id: string) {
    return this.service.updates(id);
  }

  @Post("matters/:id/updates")
  @HttpCode(201)
  @RequirePermission("update", "matter")
  addUpdate(
    @Param("id") id: string,
    @Body(ZodBody(addUpdateSchema)) body: { body: string; documentIds?: string[] },
    @CurrentUser() user: Principal,
  ) {
    return this.service.addUpdate(id, body.body, body.documentIds ?? [], user.userId);
  }

  @Get("matters/:id/notes")
  @RequirePermission("read", "matter_note")
  notes(@Param("id") id: string) {
    return this.service.notes(id);
  }

  @Post("matters/:id/notes")
  @HttpCode(201)
  @RequirePermission("write", "matter_note")
  addNote(
    @Param("id") id: string,
    @Body(ZodBody(noteBodySchema)) body: { body: string },
    @CurrentUser() user: Principal,
  ) {
    return this.service.addNote(id, body.body, user.userId);
  }

  @Patch("matters/:id/notes/:nid")
  @RequirePermission("write", "matter_note")
  updateNote(
    @Param("id") id: string,
    @Param("nid") nid: string,
    @Body(ZodBody(noteBodySchema)) body: { body: string },
  ) {
    return this.service.updateNote(id, nid, body.body);
  }

  @Delete("matters/:id/notes/:nid")
  @HttpCode(204)
  @RequirePermission("write", "matter_note")
  async deleteNote(@Param("id") id: string, @Param("nid") nid: string) {
    await this.service.deleteNote(id, nid);
  }

  @Get("matters/:id/financials")
  @RequirePermission("read", "matter")
  financials(@Param("id") id: string) {
    return this.service.financials(id);
  }

  @Get("matters/:id/activity")
  @RequirePermission("read", "matter")
  activity(@Param("id") id: string) {
    return this.service.activityFeed(id);
  }
}
