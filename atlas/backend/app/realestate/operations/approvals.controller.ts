import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ApprovalsService } from "./approvals-service.js";
import { createApprovalSchema, decideApprovalSchema, type CreateApprovalBody, type DecideApprovalBody } from "./approvals.schema.js";
import type { ApprovalStatus } from "./approvals-repository.js";

@ApiTags("realestate · approvals")
@ApiBearerAuth("access-token")
@Controller("realestate/approvals")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get()
  @RequirePermission("read", "approval")
  list(@Query("status") status?: ApprovalStatus) {
    return this.service.list(status);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "approval")
  create(@Body(ZodBody(createApprovalSchema)) body: CreateApprovalBody) {
    return this.service.create(body);
  }

  @Post(":id/decide")
  @RequirePermission("approve", "approval")
  decide(@Param("id") id: string, @Body(ZodBody(decideApprovalSchema)) body: DecideApprovalBody, @CurrentUser() user: Principal) {
    return this.service.decide(id, body.decision, user.userId);
  }
}
