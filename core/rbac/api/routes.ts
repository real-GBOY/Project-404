import type { FastifyPluginAsync } from "fastify";
import { parseBody } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth } from "../../identity/api/auth-middleware.js";
import type { RbacService } from "../application/rbac-service.js";
import { assignRoleSchema, createRoleSchema, grantPermissionSchema } from "../validation/schemas.js";

export function rbacRoutes(service: RbacService, ctx: RouteContext): FastifyPluginAsync {
  return async (app) => {
    app.addHook("preHandler", ctx.authenticate);

    app.get("/rbac/roles", { preHandler: ctx.guard("read", "role") }, async () => ({
      roles: await service.listRoles(),
    }));

    app.post("/rbac/roles", { preHandler: ctx.guard("manage", "role") }, async (req, reply) => {
      const input = parseBody(createRoleSchema, req.body);
      reply.status(201).send({ role: await service.createRole(input) });
    });

    app.post<{ Params: { roleKey: string } }>(
      "/rbac/roles/:roleKey/permissions",
      { preHandler: ctx.guard("manage", "role") },
      async (req, reply) => {
        const { action, resource } = parseBody(grantPermissionSchema, req.body);
        await service.grantPermission(req.params.roleKey, action, resource);
        reply.status(204).send();
      },
    );

    app.delete<{ Params: { roleKey: string; permissionKey: string } }>(
      "/rbac/roles/:roleKey/permissions/:permissionKey",
      { preHandler: ctx.guard("manage", "role") },
      async (req, reply) => {
        await service.revokePermission(req.params.roleKey, req.params.permissionKey);
        reply.status(204).send();
      },
    );

    app.post("/rbac/assignments", { preHandler: ctx.guard("assign", "role") }, async (req, reply) => {
      const input = parseBody(assignRoleSchema, req.body);
      await service.assignRole(input.userId, input.roleKey, requireAuth(req).userId);
      reply.status(204).send();
    });

    app.delete<{ Params: { userId: string; roleKey: string } }>(
      "/rbac/assignments/:userId/:roleKey",
      { preHandler: ctx.guard("assign", "role") },
      async (req, reply) => {
        await service.removeRole(req.params.userId, req.params.roleKey);
        reply.status(204).send();
      },
    );

    app.get<{ Params: { userId: string } }>(
      "/rbac/users/:userId",
      { preHandler: ctx.guard("read", "role") },
      async (req) => ({
        roles: await service.rolesForUser(req.params.userId),
        permissions: await service.permissionsForUser(req.params.userId),
      }),
    );
  };
}
