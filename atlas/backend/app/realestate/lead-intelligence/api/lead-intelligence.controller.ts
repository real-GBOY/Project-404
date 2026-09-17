import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { LeadIntelligenceService } from "../application/lead-intelligence-service.js";
import { extractRequirementsSchema, type ExtractRequirementsBody } from "../validation/lead-intelligence.schema.js";

/**
 * Atlas AI Lead Intelligence & Property Matching — see
 * docs/lead-intelligence.md. Two actions on the existing Lead resource, both
 * gated by `analyze:lead` (checked here, re-checked nowhere else — the
 * service composes other domains' REPOSITORIES directly and inherits their
 * RLS/tenant scoping, same as the Dashboard's own composition):
 *
 *  - `POST :id/ai/requirements` — AI turns free-text notes into a structured
 *    requirement profile, persisted on the lead.
 *  - `POST :id/ai/brief` — deterministic matching against real inventory,
 *    a deterministic recommended next action, and a best-effort AI
 *    explanation/draft message. Requires the requirements step to have run
 *    at least once (400 otherwise).
 */
@ApiTags("realestate · lead intelligence")
@ApiBearerAuth("access-token")
@Controller("realestate/leads")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LeadIntelligenceController {
  constructor(private readonly service: LeadIntelligenceService) {}

  @Post(":id/ai/requirements")
  @RequirePermission("analyze", "lead")
  extractRequirements(
    @Param("id") id: string,
    @Body(ZodBody(extractRequirementsSchema)) body: ExtractRequirementsBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.extractRequirements(id, body.notes, user.userId);
  }

  @Post(":id/ai/brief")
  @RequirePermission("analyze", "lead")
  getBrief(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.getBrief(id, user.userId);
  }
}
