import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ConversationInsightsService } from "../application/insights-service.js";
import {
  applyRequirementsSchema,
  createFollowupSchema,
  type ApplyRequirementsBody,
  type CreateFollowupBody,
} from "../validation/schemas.js";

/**
 * Atlas conversation intelligence over a Core messaging conversation
 * (docs/messaging.md §7). Reading is membership-checked; nothing here mutates CRM
 * data unless a person explicitly asks (`apply-requirements`, `followups`).
 * Fresh analyses arrive asynchronously as `atlas:conversation:ai_updated`.
 */
@ApiTags("realestate · conversation intelligence")
@ApiBearerAuth("access-token")
@Controller("realestate/conversations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ConversationInsightsController {
  constructor(private readonly insights: ConversationInsightsService) {}

  @Get(":id/insights")
  @RequirePermission("read", "conversation_insight")
  get(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.insights.get(user.userId, id);
  }

  /** Queue a fresh analysis (202: returns the current insights at once; the update follows over the socket). */
  @Post(":id/insights/refresh")
  @HttpCode(202)
  @RequirePermission("read", "conversation_insight")
  refresh(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.insights.refresh(user.userId, id);
  }

  @Post(":id/insights/apply-requirements")
  @HttpCode(200)
  @RequirePermission("apply", "conversation_insight")
  applyRequirements(
    @Param("id") id: string,
    @Body(ZodBody(applyRequirementsSchema)) body: ApplyRequirementsBody,
    @CurrentUser() user: Principal,
  ) {
    return this.insights.applyRequirements(user.userId, id, body.leadId);
  }

  @Post(":id/insights/followups")
  @HttpCode(201)
  @RequirePermission("apply", "conversation_insight")
  createFollowup(
    @Param("id") id: string,
    @Body(ZodBody(createFollowupSchema)) body: CreateFollowupBody,
    @CurrentUser() user: Principal,
  ) {
    return this.insights.createFollowup(user.userId, id, body);
  }
}
