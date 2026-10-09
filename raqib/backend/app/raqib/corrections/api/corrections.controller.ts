import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { CorrectionsService } from "../application/corrections-service.js";

const correctionSchema = z
  .object({
    field: z.enum(["started_at", "submitted_at", "deduction_amount"]),
    value: z.union([z.string().min(1).max(40), z.number()]),
    itemKey: z.string().min(1).max(80).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

@ApiTags("raqib · corrections")
@ApiBearerAuth("access-token")
@Controller("raqib/inspections/:inspectionId/corrections")
@UseGuards(JwtAuthGuard, AccessGuard)
export class CorrectionsController {
  constructor(private readonly service: CorrectionsService) {}

  @Get()
  @Allow("inspections", "R")
  async list(@Param("inspectionId") inspectionId: string, @Caller() who: Access) {
    return { items: await this.service.list(inspectionId, who) };
  }

  /** The module/letter depends on the field, so the service decides (times: inspections P; deduction: scoring designation). */
  @Post()
  @Allow("inspections", "R")
  async correct(@Param("inspectionId") inspectionId: string, @Body(ZodBody(correctionSchema)) b: z.infer<typeof correctionSchema>, @Caller() who: Access) {
    return { items: await this.service.correct({ inspectionId, ...b }, who) };
  }
}
