import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import { ActivityService } from "../application/activity-service.js";

const activityQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  resourceType: z.string().max(60).optional(),
});

@ApiTags("hotel · activity")
@ApiBearerAuth("access-token")
@Controller("hotel/activity")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  /** The audit trail as readable activity — Core's own `read:audit_log` permission. */
  @Get()
  @RequirePermission("read", "audit_log")
  list(@Query(ZodQuery(activityQuery)) q: z.infer<typeof activityQuery>) {
    return this.service.list(q);
  }
}
