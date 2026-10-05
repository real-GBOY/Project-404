import { Body, Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { ReviewService } from "../application/review-service.js";

const returnSchema = z.object({ reason: z.string().trim().min(3).max(1000), itemIds: z.array(z.string().min(1).max(80)).max(200).default([]) }).strict();
const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
const commentSchema = z.object({ comment: z.string().trim().max(1000).optional() }).strict();

@ApiTags("raqib · review")
@ApiBearerAuth("access-token")
@Controller("raqib/visits/:visitId/review")
@UseGuards(JwtAuthGuard, AccessGuard)
export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  /** Review stage → approval stage. Needs the review right. */
  @Post("forward")
  @HttpCode(200)
  @Allow("inspections", "V")
  forward(@Param("visitId") id: string, @Body(ZodBody(commentSchema)) b: z.infer<typeof commentSchema>, @Caller() who: Access) {
    return this.service.decide(id, "forward", { comment: b.comment }, who);
  }

  /** Send the inspection back to the inspector with a reason and the items to fix. */
  @Post("return")
  @HttpCode(200)
  @Allow("inspections", "V")
  return(@Param("visitId") id: string, @Body(ZodBody(returnSchema)) b: z.infer<typeof returnSchema>, @Caller() who: Access) {
    return this.service.decide(id, "return", b, who);
  }

  /** Final rejection, with a reason. */
  @Post("reject")
  @HttpCode(200)
  @Allow("inspections", "V")
  reject(@Param("visitId") id: string, @Body(ZodBody(rejectSchema)) b: z.infer<typeof rejectSchema>, @Caller() who: Access) {
    return this.service.decide(id, "reject", b, who);
  }

  /** Final approval. Needs the approve right (a separate permission from review). */
  @Post("approve")
  @HttpCode(200)
  @Allow("inspections", "V")
  approve(@Param("visitId") id: string, @Body(ZodBody(commentSchema)) b: z.infer<typeof commentSchema>, @Caller() who: Access) {
    return this.service.decide(id, "approve", { comment: b.comment }, who);
  }
}
