import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { readInTenant } from "@core/kernel/db/db.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { RequirePermission } from "@core/http/decorators.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import { AuditRepository, type AuditQuery } from "@core/audit/infrastructure/audit-repository.js";

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

/**
 * Read access to the append-only audit trail (§7.7). Needs `read:audit_log`.
 * Row-level security scopes results to the caller's active tenant — NULL-org
 * (system) rows are only visible to the system role, never here.
 */
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly repo: AuditRepository) {}

  /**
   * GET /api/audit-logs — filter by `actorId` / `resourceType` / `resourceId` /
   * `action` / `from` / `to`; paginate with `limit` (≤200) + `cursor` (keyset on
   * id). Returns `{ records, nextCursor }`.
   */
  @Get()
  @RequirePermission("read", "audit_log")
  async list(@Query(ZodQuery(querySchema)) q: AuditQuery) {
    // Wrapped in a transaction so the RLS `SET LOCAL` applies (§ docs/tenancy.md).
    const records = await readInTenant(() => this.repo.query(q));
    const limit = q.limit ?? 50;
    const nextCursor = records.length === limit ? records[records.length - 1]?.id : undefined;
    return { records, nextCursor };
  }
}
