import { Router } from "express";
import { z } from "zod";
import { handler, parseQuery } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import type { AuditRepository } from "../infrastructure/audit-repository.js";

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

export function auditRoutes(repo: AuditRepository, ctx: RouteContext): Router {
  const r = Router();

  r.get(
    "/audit-logs",
    ctx.authenticate,
    ctx.guard("read", "audit_log"),
    handler(async (req, res) => {
      const q = parseQuery(querySchema, req.query);
      const records = await repo.query(q);
      const nextCursor = records.length === (q.limit ?? 50) ? records[records.length - 1]?.id : undefined;
      res.json({ records, nextCursor });
    }),
  );

  return r;
}
