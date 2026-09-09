import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { getContext } from "@core/kernel/logging/context.js";
import { chatRequestSchema } from "./assistant.schema.js";
import { AssistantService } from "./assistant-service.js";

/**
 * Mizan Copilot HTTP surface. `POST /api/ai/chat` is the one endpoint that
 * matters; the two GETs back the conversation drawer.
 *
 * Auth: the standard `JwtAuthGuard` + `PermissionGuard`. `use:assistant` only
 * gates the surface — each tool the assistant invokes is re-checked against the
 * caller's own law-firm permissions inside `ToolRegistry`. The assistant runs
 * entirely as the authenticated user in their active tenant; there is no
 * service account and no bypass.
 */
@ApiTags("lawfirm · assistant")
@ApiBearerAuth("access-token")
@Controller("ai")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Post("chat")
  @RequirePermission("use", "assistant")
  chat(
    @Body(ZodBody(chatRequestSchema)) body: z.infer<typeof chatRequestSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.chat({
      userId: user.userId,
      organizationId: user.organizationId,
      locale: getContext()?.locale ?? "en",
      conversationId: body.conversationId,
      message: body.message,
      currentContext: body.currentContext,
    });
  }

  @Get("conversations")
  @RequirePermission("use", "assistant")
  list(@CurrentUser() user: Principal) {
    return this.service
      .listConversations(user.userId, user.organizationId)
      .then((items) => ({ items }));
  }

  @Get("conversations/:id")
  @RequirePermission("use", "assistant")
  get(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.getConversation(user.userId, user.organizationId, id);
  }
}
