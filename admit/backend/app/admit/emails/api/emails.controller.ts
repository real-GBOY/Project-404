import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { EmailsService } from "../application/emails-service.js";

const listQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim().toUpperCase()) : undefined))
    .pipe(z.array(z.enum(["QUEUED", "ACCEPTED", "DELIVERED", "RETRYING", "FAILED"])).optional()),
  bookingId: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

@ApiTags("admit · emails")
@ApiBearerAuth("access-token")
@Controller("admit/emails")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmailsController {
  constructor(private readonly service: EmailsService) {}

  @Get()
  @RequirePermission("read", "email")
  list(@CurrentUser() who: Principal, @Query(ZodQuery(listQuery)) q: z.infer<typeof listQuery>) {
    return this.service.list(who, q);
  }

  @Post(":id/retry")
  @HttpCode(204)
  @RequirePermission("retry", "email")
  async retry(@CurrentUser() who: Principal, @Param("id") id: string) {
    await this.service.retry(who, id);
  }
}
