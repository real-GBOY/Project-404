import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseQuery } from "../../http/handler.js";
import { readInTenant } from "../../kernel/db/db.js";
import type { RouteContext } from "../../http/route-context.js";
import type { AuditRepository, AuditQuery } from "../infrastructure/audit-repository.js";

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

export function auditRoutes(repo: AuditRepository, ctx: RouteContext): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/audit-logs",
      { preHandler: [ctx.authenticate, ctx.guard("read", "audit_log")] },
      async (req) => {
        const q = parseQuery(querySchema, req.query) as AuditQuery;
        // RLS scopes the trail to the caller's active tenant (§ docs/tenancy.md).
        const records = await readInTenant(() => repo.query(q));
        const limit = q.limit ?? 50;
        const nextCursor =
          records.length === limit ? records[records.length - 1]?.id : undefined;
        return { records, nextCursor };
      },
    );
  };
}
