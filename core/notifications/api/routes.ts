import { Router } from "express";
import { z } from "zod";
import { handler, parseQuery } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth } from "../../identity/api/auth-middleware.js";
import type { NotificationService } from "../application/notification-service.js";

const listQuery = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export function notificationRoutes(service: NotificationService, ctx: RouteContext): Router {
  const r = Router();
  r.use(ctx.authenticate);

  r.get(
    "/notifications",
    handler(async (req, res) => {
      const principal = requireAuth(req);
      const q = parseQuery(listQuery, req.query);
      const rows = await service.listForUser(principal.userId, q);
      res.json({
        notifications: rows.map((row) => service.toPublic(row)),
        unreadCount: await service.unreadCount(principal.userId),
        nextCursor: rows.length === (q.limit ?? 30) ? rows[rows.length - 1]?.id : undefined,
      });
    }),
  );

  r.post(
    "/notifications/:id/read",
    handler(async (req, res) => {
      const principal = requireAuth(req);
      await service.markRead(principal.userId, req.params.id);
      res.status(204).end();
    }),
  );

  r.post(
    "/notifications/read-all",
    handler(async (req, res) => {
      const principal = requireAuth(req);
      await service.markAllRead(principal.userId);
      res.status(204).end();
    }),
  );

  return r;
}
