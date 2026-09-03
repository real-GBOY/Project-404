import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { HearingsService } from "./hearings-service.js";

const listQuery = z.object({
  matterId: z.string().optional(),
  status: z.enum(["scheduled", "adjourned", "decided"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  scope: z.enum(["upcoming", "past"]).optional(),
});
const createSchema = z.object({
  matterId: z.string().min(1),
  court: z.string().trim().max(160).optional(),
  scheduledAt: z.string().optional(),
  purpose: z.string().trim().max(300).optional(),
});
const updateSchema = z.object({
  court: z.string().trim().max(160).optional(),
  scheduledAt: z.string().optional(),
  purpose: z.string().trim().max(300).optional(),
});
const adjournSchema = z.object({
  newDate: z.string().min(1),
  reason: z.string().trim().max(1000).optional(),
});
const outcomeSchema = z.object({ outcome: z.string().trim().min(1).max(2000) });

@ApiTags("lawfirm · hearings")
@ApiBearerAuth("access-token")
@Controller("hearings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class HearingsController {
  constructor(private readonly service: HearingsService) {}

  @Get("summary")
  @RequirePermission("read", "hearing")
  summary() {
    return this.service.summary();
  }

  @Get()
  @RequirePermission("read", "hearing")
  list(@Query(ZodQuery(listQuery)) q: z.infer<typeof listQuery>) {
    return this.service.list(q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("schedule", "hearing")
  create(
    @Body(ZodBody(createSchema)) body: z.infer<typeof createSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.create(body, user.userId);
  }

  @Get(":id")
  @RequirePermission("read", "hearing")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id")
  @RequirePermission("update", "hearing")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateSchema)) body: z.infer<typeof updateSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }

  @Post(":id/adjourn")
  @RequirePermission("schedule", "hearing")
  adjourn(
    @Param("id") id: string,
    @Body(ZodBody(adjournSchema)) body: z.infer<typeof adjournSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.adjourn(id, body.newDate, body.reason, user.userId);
  }

  @Post(":id/outcome")
  @RequirePermission("update", "hearing")
  outcome(
    @Param("id") id: string,
    @Body(ZodBody(outcomeSchema)) body: z.infer<typeof outcomeSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.recordOutcome(id, body.outcome, user.userId);
  }
}
