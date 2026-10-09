import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ValidationError } from "@core/kernel/errors.js";
import { csvToXlsx } from "@raqib/raqib/shared/xlsx.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { AnalyticsService, type AnalyticsQuery } from "../application/analytics-service.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.object({
  period: z.enum(["week", "month", "quarter", "year", "custom"]).default("month"),
  from: date.optional(),
  to: date.optional(),
  projectId: z.string().min(1).max(80).optional(),
  siteId: z.string().min(1).max(80).optional(),
  sort: z.enum(["attention", "observations", "improvement", "complaints", "contract", "score"]).optional(),
});

function parse(q: unknown): AnalyticsQuery {
  const r = schema.safeParse(q);
  if (!r.success) throw ValidationError("raqib.invalid_query", "Invalid analytics filters.");
  return r.data;
}

@ApiTags("raqib · analytics")
@ApiBearerAuth("access-token")
@Controller("raqib/analytics")
@UseGuards(JwtAuthGuard, AccessGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get()
  @Allow("analytics", "V")
  run(@Query() q: unknown, @Caller() who: Access) {
    return this.service.run(parse(q), who);
  }

  @Get("export")
  @Allow("analytics", "X")
  async export(@Query() q: unknown, @Caller() who: Access, @Res() reply: FastifyReply) {
    const csv = await this.service.csv(parse(q), who);
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="raqib-analytics.csv"')
      .header("Cache-Control", "private, no-store")
      .send(csv);
  }

  /** The same figures as a native Excel workbook (`.xlsx`), for people who want a spreadsheet rather than a CSV. */
  @Get("export.xlsx")
  @Allow("analytics", "X")
  async exportXlsx(@Query() q: unknown, @Caller() who: Access, @Res() reply: FastifyReply) {
    const csv = await this.service.csv(parse(q), who);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="raqib-analytics.xlsx"')
      .header("Cache-Control", "private, no-store")
      .send(csvToXlsx(csv, { sheet: "Analytics", rtl: true }));
  }
}
