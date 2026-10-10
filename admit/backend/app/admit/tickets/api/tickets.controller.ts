import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { TicketsService } from "../application/tickets-service.js";

const searchQuery = z.object({
  eventId: z.string().max(64).optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const exportQuery = searchQuery.pick({ eventId: true, q: true });
const revokeSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

@ApiTags("admit · tickets")
@ApiBearerAuth("access-token")
@Controller("admit/tickets")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Get()
  @RequirePermission("read", "ticket")
  async search(@CurrentUser() who: Principal, @Query(ZodQuery(searchQuery)) q: z.infer<typeof searchQuery>) {
    return { items: await this.service.search(who, q) };
  }

  /** The attendee list as CSV. Registered before ":id" so "export.csv" is not read as a ticket id. */
  @Get("export.csv")
  @RequirePermission("read", "ticket")
  async exportCsv(
    @CurrentUser() who: Principal,
    @Query(ZodQuery(exportQuery)) q: z.infer<typeof exportQuery>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { name, csv } = await this.service.exportCsv(who, q);
    reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="${name}"`).header("cache-control", "no-store");
    return csv;
  }

  @Get(":id")
  @RequirePermission("read", "ticket")
  get(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.get(who, id);
  }

  @Post(":id/revoke")
  @HttpCode(200)
  @RequirePermission("revoke", "ticket")
  revoke(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(revokeSchema)) b: z.infer<typeof revokeSchema>) {
    return this.service.revoke(who, id, b.reason);
  }
}
