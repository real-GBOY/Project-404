import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ValidationError } from "@core/kernel/errors.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { AuditService, type AuditQueryInput } from "../application/audit-service.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.object({
  q: z.string().max(100).optional(),
  entity: z.string().max(80).optional(),
  actor: z.string().max(80).optional(),
  from: date.optional(),
  to: date.optional(),
});

function parse(q: unknown): AuditQueryInput {
  const r = schema.safeParse(q);
  if (!r.success) throw ValidationError("raqib.invalid_query", "Invalid audit filters.");
  return r.data;
}

@ApiTags("raqib · audit")
@ApiBearerAuth("access-token")
@Controller("raqib/audit")
@UseGuards(JwtAuthGuard, AccessGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @Allow("audit", "V")
  list(@Query() q: unknown, @Caller() who: Access) {
    return this.service.list(parse(q), who);
  }

  @Get("export")
  @Allow("audit", "X")
  async export(@Query() q: unknown, @Caller() who: Access, @Res() reply: FastifyReply) {
    const csv = await this.service.csv(parse(q), who);
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", "attachment; filename=\"raqib-audit.csv\"")
      .header("Cache-Control", "private, no-store")
      .send(csv);
  }
}
