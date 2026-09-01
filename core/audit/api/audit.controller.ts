import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { readInTenant } from "../../kernel/db/db.js";
import { JwtAuthGuard } from "../../http/jwt-auth.guard.js";
import { PermissionGuard } from "../../http/permission.guard.js";
import { RequirePermission } from "../../http/decorators.js";
import { ZodQuery } from "../../http/zod.pipe.js";
import { AuditRepository, type AuditQuery } from "../infrastructure/audit-repository.js";

const querySchema = z.object({
  actorId: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly repo: AuditRepository) {}

  @Get()
  @RequirePermission("read", "audit_log")
  async list(@Query(ZodQuery(querySchema)) q: AuditQuery) {
    // RLS scopes the trail to the caller's active tenant (§ docs/tenancy.md).
    const records = await readInTenant(() => this.repo.query(q));
    const limit = q.limit ?? 50;
    const nextCursor = records.length === limit ? records[records.length - 1]?.id : undefined;
    return { records, nextCursor };
  }
}
