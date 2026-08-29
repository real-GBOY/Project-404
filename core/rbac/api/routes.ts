import { Router } from "express";
import { handler, parseBody } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth } from "../../identity/api/auth-middleware.js";
import type { RbacService } from "../application/rbac-service.js";
import { assignRoleSchema, createRoleSchema, grantPermissionSchema } from "../validation/schemas.js";

export function rbacRoutes(service: RbacService, ctx: RouteContext): Router {
  const r = Router();
  r.use(ctx.authenticate);

  r.get(
    "/rbac/roles",
    ctx.guard("read", "role"),
    handler(async (_req, res) => {
      res.json({ roles: await service.listRoles() });
    }),
  );

  r.post(
    "/rbac/roles",
    ctx.guard("manage", "role"),
    handler(async (req, res) => {
      const input = parseBody(createRoleSchema, req.body);
      res.status(201).json({ role: await service.createRole(input) });
    }),
  );

  r.post(
    "/rbac/roles/:roleKey/permissions",
    ctx.guard("manage", "role"),
    handler(async (req, res) => {
      const { action, resource } = parseBody(grantPermissionSchema, req.body);
      await service.grantPermission(req.params.roleKey, action, resource);
      res.status(204).end();
    }),
  );

  r.delete(
    "/rbac/roles/:roleKey/permissions/:permissionKey",
    ctx.guard("manage", "role"),
    handler(async (req, res) => {
      await service.revokePermission(req.params.roleKey, req.params.permissionKey);
      res.status(204).end();
    }),
  );

  r.post(
    "/rbac/assignments",
    ctx.guard("assign", "role"),
    handler(async (req, res) => {
      const input = parseBody(assignRoleSchema, req.body);
      const principal = requireAuth(req);
      await service.assignRole(input.userId, input.roleKey, principal.userId);
      res.status(204).end();
    }),
  );

  r.delete(
    "/rbac/assignments/:userId/:roleKey",
    ctx.guard("assign", "role"),
    handler(async (req, res) => {
      await service.removeRole(req.params.userId, req.params.roleKey);
      res.status(204).end();
    }),
  );

  r.get(
    "/rbac/users/:userId",
    ctx.guard("read", "role"),
    handler(async (req, res) => {
      res.json({
        roles: await service.rolesForUser(req.params.userId),
        permissions: await service.permissionsForUser(req.params.userId),
      });
    }),
  );

  return r;
}
