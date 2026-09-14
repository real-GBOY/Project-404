import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import type { Principal } from "@core/http/principal.js";
import { InsightsService } from "./insights-service.js";
import type { InsightKind } from "./insights-repository.js";

@ApiTags("realestate · AI insights")
@ApiBearerAuth("access-token")
@Controller("realestate/insights")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get()
  @RequirePermission("read", "ai_insight")
  list(@Query("kind") kind: InsightKind = "feed") {
    return this.service.list(kind);
  }

  @Post(":id/dismiss")
  @RequirePermission("dismiss", "ai_insight")
  dismiss(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.dismiss(id, user.userId);
  }
}
