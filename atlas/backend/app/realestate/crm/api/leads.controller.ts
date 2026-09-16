import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { LeadsService } from "../application/leads-service.js";
import {
  createLeadSchema,
  listLeadsQuery,
  trackAsDealSchema,
  updateLeadSchema,
  type CreateLeadBody,
  type ListLeadsQuery,
  type TrackAsDealBody,
  type UpdateLeadBody,
} from "../validation/leads.schema.js";

/**
 * Backs three frontend screens over one entity (see `lead.domain.ts`): CRM >
 * Leads (`status` filter), CRM > Pipeline (`stage` groups, `PATCH :id/stage`
 * for drag-and-drop), Sales > Deals (`dealsOnly=true`, `POST :id/track-as-deal`).
 */
@ApiTags("realestate · leads")
@ApiBearerAuth("access-token")
@Controller("realestate/leads")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  @RequirePermission("read", "lead")
  list(@Query(ZodQuery(listLeadsQuery)) q: ListLeadsQuery) {
    return this.service.list(q);
  }

  @Get(":id")
  @RequirePermission("read", "lead")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "lead")
  create(@Body(ZodBody(createLeadSchema)) body: CreateLeadBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "lead")
  update(@Param("id") id: string, @Body(ZodBody(updateLeadSchema)) body: UpdateLeadBody, @CurrentUser() user: Principal) {
    return this.service.update(id, body, user.userId);
  }

  @Post(":id/track-as-deal")
  @RequirePermission("update", "lead")
  trackAsDeal(
    @Param("id") id: string,
    @Body(ZodBody(trackAsDealSchema)) body: TrackAsDealBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.trackAsDeal(id, body, user.userId);
  }
}
