import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseQuery } from "../../http/handler.js";
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

export function notificationRoutes(service: NotificationService, ctx: RouteContext): FastifyPluginAsync {
  return async (app) => {
    app.addHook("preHandler", ctx.authenticate);

    app.get("/notifications", async (req) => {
      const principal = requireAuth(req);
      const q = parseQuery(listQuery, req.query);
      const rows = await service.listForUser(principal.userId, q);
      return {
        notifications: rows.map((row) => service.toPublic(row)),
        unreadCount: await service.unreadCount(principal.userId),
        nextCursor: rows.length === (q.limit ?? 30) ? rows[rows.length - 1]?.id : undefined,
      };
    });

    app.post<{ Params: { id: string } }>("/notifications/:id/read", async (req, reply) => {
      await service.markRead(requireAuth(req).userId, req.params.id);
      reply.status(204).send();
    });

    app.post("/notifications/read-all", async (req, reply) => {
      await service.markAllRead(requireAuth(req).userId);
      reply.status(204).send();
    });
  };
}
