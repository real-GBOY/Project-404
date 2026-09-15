import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { getContext } from "@core/kernel/logging/context.js";
import { askSchema, type AskBody } from "./assistant.schema.js";
import { AssistantService } from "./assistant-service.js";

/**
 * Atlas Copilot HTTP surface. `POST /realestate/copilot/ask` is the one
 * endpoint that matters; the two GETs back the conversation rail.
 *
 * Auth: the standard `JwtAuthGuard` + `PermissionGuard`. `ask:ai_conversation`
 * (and `read:ai_conversation` for the two GETs) only gate the surface — each
 * tool the assistant invokes is re-checked against the caller's own real-estate
 * permissions inside `ToolRegistry`. The assistant runs entirely as the
 * authenticated user in their active tenant; there is no service account and no
 * bypass. See docs/atlas-assistant.md.
 */
@ApiTags("realestate · AI copilot")
@ApiBearerAuth("access-token")
@Controller("realestate/copilot")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get("conversations")
  @RequirePermission("read", "ai_conversation")
  conversations(@CurrentUser() user: Principal) {
    return this.service
      .listConversations(user.userId, user.organizationId)
      .then((items) => ({ items }));
  }

  @Get("conversations/:id")
  @RequirePermission("read", "ai_conversation")
  conversation(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.getConversation(user.userId, user.organizationId, id);
  }

  @Post("ask")
  @RequirePermission("ask", "ai_conversation")
  ask(@Body(ZodBody(askSchema)) body: AskBody, @CurrentUser() user: Principal) {
    return this.service.chat({
      userId: user.userId,
      organizationId: user.organizationId,
      locale: getContext()?.locale ?? "en",
      conversationId: body.conversationId ?? undefined,
      message: body.question,
      currentContext: body.currentContext,
    });
  }
}
