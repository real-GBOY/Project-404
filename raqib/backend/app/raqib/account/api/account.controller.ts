import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller, SetupRoute } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { LifecycleService } from "@raqib/raqib/lifecycle/lifecycle-service.js";
import { AccountService } from "../application/account-service.js";

const code = z.string().trim().min(6).max(20);
const enableSchema = z.object({ code }).strict();
const disableSchema = z.object({ password: z.string().min(1).max(200), code }).strict();
const passwordSchema = z.object({ current: z.string().min(1).max(200), next: z.string().min(10).max(200) }).strict();
const resetSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

/**
 * The signed-in person's own security: second factor, password, sessions. These routes stay open to someone whose
 * organization is waiting for them to finish set-up (`@SetupRoute`) — that is how they finish it.
 */
@ApiTags("raqib · account security")
@ApiBearerAuth("access-token")
@Controller("raqib/account")
@UseGuards(JwtAuthGuard, AccessGuard)
export class AccountController {
  constructor(
    private readonly service: AccountService,
    private readonly lifecycle: LifecycleService,
  ) {}

  @Get("security")
  @Allow()
  @SetupRoute()
  status(@Caller() who: Access) {
    return this.service.status(who);
  }

  @Post("mfa/setup")
  @HttpCode(200)
  @Allow()
  @SetupRoute()
  setup(@Caller() who: Access) {
    return this.service.beginMfa(who);
  }

  @Post("mfa/enable")
  @HttpCode(200)
  @Allow()
  @SetupRoute()
  enable(@Body(ZodBody(enableSchema)) b: z.infer<typeof enableSchema>, @Caller() who: Access) {
    return this.service.enableMfa(who, b.code);
  }

  @Post("mfa/disable")
  @HttpCode(204)
  @Allow()
  async disable(@Body(ZodBody(disableSchema)) b: z.infer<typeof disableSchema>, @Caller() who: Access) {
    await this.service.disableMfa(who, b.password, b.code);
  }

  @Post("password")
  @HttpCode(204)
  @Allow()
  @SetupRoute()
  async password(@Body(ZodBody(passwordSchema)) b: z.infer<typeof passwordSchema>, @Caller() who: Access) {
    await this.service.changePassword(who, b.current, b.next);
  }

  @Post("sessions/revoke")
  @HttpCode(204)
  @Allow()
  async revoke(@Caller() who: Access) {
    await this.service.revokeAllSessions(who);
  }

  /** Everything held about one person, for a data-subject request. Needs the users export right; audited. */
  @Get("users/:id/personal-data")
  @Allow("users", "X")
  personalData(@Param("id") id: string, @Caller() who: Access) {
    return this.lifecycle.exportPersonalData(id, who);
  }

  /** An administrator clears another person's second factor (lost device and recovery codes). */
  @Post("users/:id/mfa-reset")
  @HttpCode(204)
  @Allow("users", "E")
  async adminReset(@Param("id") id: string, @Body(ZodBody(resetSchema)) b: z.infer<typeof resetSchema>, @Caller() who: Access) {
    await this.service.adminResetMfa(id, b.reason, who);
  }
}
