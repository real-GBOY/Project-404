import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { AssistantService } from "./assistant-service.js";
import { askSchema, type AskBody } from "./assistant.schema.js";

@ApiTags("realestate · AI copilot")
@ApiBearerAuth("access-token")
@Controller("realestate/copilot")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get("conversations")
  @RequirePermission("read", "ai_conversation")
  conversations(@CurrentUser() user: Principal) {
    return this.service.conversations(user.userId);
  }

  @Get("conversations/:id/messages")
  @RequirePermission("read", "ai_conversation")
  messages(@Param("id") id: string) {
    return this.service.messages(id);
  }

  @Get("suggestions")
  @RequirePermission("read", "ai_conversation")
  suggestions() {
    return this.service.suggestions();
  }

  @Post("ask")
  @HttpCode(201)
  @RequirePermission("ask", "ai_conversation")
  ask(@Body(ZodBody(askSchema)) body: AskBody, @CurrentUser() user: Principal) {
    return this.service.ask(body.conversationId ?? undefined, body.question, user.userId);
  }
}
