import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { TeamService } from "../application/team-service.js";

const changeSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(10, "The new password must be at least 10 characters.").max(200),
  })
  .strict();

/** The signed-in person's own account. Needs only a valid session: everyone may change their own password. */
@ApiTags("admit · account")
@ApiBearerAuth("access-token")
@Controller("admit/me")
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly team: TeamService) {}

  @Post("password")
  @HttpCode(204)
  async changePassword(@CurrentUser() who: Principal, @Body(ZodBody(changeSchema)) b: z.infer<typeof changeSchema>) {
    await this.team.changeOwnPassword(who, b.currentPassword, b.newPassword);
  }
}
