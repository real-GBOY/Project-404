import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { ScoringService } from "../application/scoring-service.js";

const points = z.number().int().min(0).max(100);
const publishSchema = z
  .object({
    bySeverity: z.object({ low: points.optional(), medium: points.optional(), high: points.optional() }).strict().default({}),
    byItem: z.record(z.string().min(1).max(80), points).default({}),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
const designateSchema = z.object({ userId: z.string().min(1).max(64) }).strict();

@ApiTags("raqib · scoring")
@ApiBearerAuth("access-token")
@Controller("raqib/scoring")
@UseGuards(JwtAuthGuard, AccessGuard)
export class ScoringController {
  constructor(private readonly service: ScoringService) {}

  @Get()
  @Allow("settings", "V")
  overview(@Caller() who: Access) {
    return this.service.overview(who);
  }

  /** Publishing is gated on a designation, not on a template right (checked in the service). */
  @Put()
  @Allow()
  publish(@Body(ZodBody(publishSchema)) b: z.infer<typeof publishSchema>, @Caller() who: Access) {
    return this.service.publish({ bySeverity: b.bySeverity as Record<string, number>, byItem: b.byItem, reason: b.reason }, who);
  }

  @Post("designees")
  @HttpCode(204)
  @Allow()
  async designate(@Body(ZodBody(designateSchema)) b: z.infer<typeof designateSchema>, @Caller() who: Access) {
    await this.service.designate(b.userId, who);
  }

  @Delete("designees/:userId")
  @HttpCode(204)
  @Allow()
  async revoke(@Param("userId") userId: string, @Caller() who: Access) {
    await this.service.revoke(userId, who);
  }
}
