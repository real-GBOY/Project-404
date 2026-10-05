import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { OnboardingService } from "../application/onboarding-service.js";

const approveSchema = z
  .object({ role: z.enum(["qe", "pm", "ins", "gs", "guard"]), projectIds: z.array(z.string().min(1).max(80)).max(50).default([]), comment: z.string().trim().max(500).optional() })
  .strict();
const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();

@ApiTags("raqib · account requests")
@ApiBearerAuth("access-token")
@Controller("raqib/account-requests")
@UseGuards(JwtAuthGuard, AccessGuard)
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Get()
  @Allow("users", "V")
  async list(@Caller() who: Access) {
    return { items: await this.service.list(who) };
  }

  @Get(":id")
  @Allow("users", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  /** Approve with a role and projects: creates the account and emails the secure password-setup link. */
  @Post(":id/approve")
  @HttpCode(200)
  @Allow("users", "A")
  approve(@Param("id") id: string, @Body(ZodBody(approveSchema)) b: z.infer<typeof approveSchema>, @Caller() who: Access) {
    return this.service.approve(id, b, who);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @Allow("users", "A")
  reject(@Param("id") id: string, @Body(ZodBody(rejectSchema)) b: z.infer<typeof rejectSchema>, @Caller() who: Access) {
    return this.service.reject(id, b.reason, who);
  }

  @Post(":id/resend")
  @HttpCode(204)
  @Allow("users", "A")
  async resend(@Param("id") id: string, @Caller() who: Access) {
    await this.service.resend(id, who);
  }
}
