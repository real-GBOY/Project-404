import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ValidationError } from "@core/kernel/errors.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { ReportsService } from "../application/reports-service.js";
import { parsePage, toPage } from "@raqib/raqib/shared/paging.js";

const langSchema = z.enum(["ar", "en"]);

@ApiTags("raqib · reports")
@ApiBearerAuth("access-token")
@Controller("raqib/reports")
@UseGuards(JwtAuthGuard, AccessGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  @Allow("reports", "V")
  async list(@Query() q: { limit?: string; cursor?: string }, @Caller() who: Access) {
    const page = parsePage(q);
    return toPage(await this.service.list(who, page), page);
  }

  @Get(":id")
  @Allow("reports", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  /**
   * The report as a print-ready HTML page built from the frozen snapshot: scope-checked and audited. The web app loads it into a hidden
   * frame and prints it ("Save as PDF"). `?lang=ar|en`.
   */
  @Get(":id/html")
  @Allow("reports", "D")
  async html(@Param("id") id: string, @Query("lang") lang: string | undefined, @Caller() who: Access, @Res() reply: FastifyReply) {
    const parsed = langSchema.safeParse(lang ?? "en");
    if (!parsed.success) throw ValidationError("raqib.invalid_language", "Language must be ar or en.");
    const f = await this.service.printableOf(id, parsed.data, who);
    reply.header("Content-Type", "text/html; charset=utf-8").header("Cache-Control", "private, no-store").send(f.html);
  }
}
