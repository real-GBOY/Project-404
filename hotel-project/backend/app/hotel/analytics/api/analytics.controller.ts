import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import { AnalyticsService, type AnalyticsRange } from "../application/analytics-service.js";

const analyticsQuery = z.object({
  days: z
    .enum(["7", "30", "90"])
    .default("30")
    .transform((v) => Number(v) as AnalyticsRange),
});

@ApiTags("hotel · analytics")
@ApiBearerAuth("access-token")
@Controller("hotel/analytics")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get()
  @RequirePermission("read", "analytics")
  overview(@Query(ZodQuery(analyticsQuery)) q: z.infer<typeof analyticsQuery>) {
    return this.service.overview(q.days);
  }
}
