import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { FollowupsService } from "./followups-service.js";
import {
  createFollowupSchema,
  listFollowupsQuery,
  updateFollowupStatusSchema,
  type CreateFollowupBody,
  type ListFollowupsQuery,
  type UpdateFollowupStatusBody,
} from "./followups.schema.js";

@ApiTags("realestate · followups")
@ApiBearerAuth("access-token")
@Controller("realestate/followups")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FollowupsController {
  constructor(private readonly service: FollowupsService) {}

  @Get()
  @RequirePermission("read", "followup")
  list(@Query(ZodQuery(listFollowupsQuery)) q: ListFollowupsQuery) {
    return this.service.list(q.agentId, q.status);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "followup")
  create(@Body(ZodBody(createFollowupSchema)) body: CreateFollowupBody) {
    return this.service.create(body);
  }

  @Patch(":id/status")
  @RequirePermission("update", "followup")
  updateStatus(@Param("id") id: string, @Body(ZodBody(updateFollowupStatusSchema)) body: UpdateFollowupStatusBody) {
    return this.service.updateStatus(id, body.status);
  }
}
