import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { CheckinService } from "../application/checkin-service.js";

const scanSchema = z
  .object({
    token: z.string().trim().min(1).max(200).optional(),
    ticketId: z.string().trim().min(6).max(24).optional(),
    eventId: z.string().min(1).max(64),
    gate: z.string().trim().max(40).optional(),
  })
  .strict()
  .refine((b) => !!b.token !== !!b.ticketId, { message: "Send either the scanned token or a typed ticket ID.", path: ["token"] });

@ApiTags("admit · check-in")
@ApiBearerAuth("access-token")
@Controller("admit/checkin")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CheckinController {
  constructor(private readonly service: CheckinService) {}

  /** Always 200 with a verdict in the body: a scanner needs INVALID and ALREADY_USED as answers, not as errors. */
  @Post()
  @HttpCode(200)
  @RequirePermission("scan", "checkin")
  scan(@CurrentUser() who: Principal, @Body(ZodBody(scanSchema)) b: z.infer<typeof scanSchema>) {
    return this.service.scan(who, b);
  }

  @Get("events")
  @RequirePermission("scan", "checkin")
  myEvents(@CurrentUser() who: Principal) {
    return this.service.myEvents(who);
  }

  @Get("events/:eventId/overview")
  @RequirePermission("read", "checkin")
  overview(@CurrentUser() who: Principal, @Param("eventId") eventId: string) {
    return this.service.overview(who, eventId);
  }
}
