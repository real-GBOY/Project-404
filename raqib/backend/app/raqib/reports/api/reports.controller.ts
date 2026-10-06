import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { AppError, ValidationError } from "@core/kernel/errors.js";
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
    return { ...toPage(await this.service.list(who, page), page), pdf: this.service.pdfAvailable() };
  }

  @Get(":id")
  @Allow("reports", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  /** The PDF rendered from the frozen snapshot — scope-checked, audited. `?lang=ar|en`. */
  @Get(":id/pdf")
  @Allow("reports", "D")
  async pdf(@Param("id") id: string, @Query("lang") lang: string | undefined, @Caller() who: Access, @Res() reply: FastifyReply) {
    const parsed = langSchema.safeParse(lang ?? "en");
    if (!parsed.success) throw ValidationError("raqib.invalid_language", "Language must be ar or en.");
    if (!this.service.pdfAvailable()) {
      throw new AppError({ code: "raqib.pdf_unavailable", message: "PDF generation is not configured on this server.", kind: "unavailable" });
    }
    const f = await this.service.pdfOf(id, parsed.data, who);
    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(f.name)}"`)
      .header("Cache-Control", "private, no-store")
      .send(f.content);
  }
}
