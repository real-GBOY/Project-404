import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ReportsService } from "../application/reports-service.js";

const overviewQuery = z.object({ eventId: z.string().max(64).optional(), days: z.coerce.number().int().min(1).max(365).default(30) });

@ApiTags("admit · reports")
@ApiBearerAuth("access-token")
@Controller("admit/reports")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("overview")
  @RequirePermission("read", "report")
  overview(@CurrentUser() who: Principal, @Query(ZodQuery(overviewQuery)) q: z.infer<typeof overviewQuery>) {
    return this.service.overview(who, q);
  }
}
