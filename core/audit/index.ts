import type { FastifyPluginAsync } from "fastify";
import type { IAuditLogger } from "../contracts/index.js";
import type { RouteContext } from "../http/route-context.js";
import type { PermissionDefinition } from "../rbac/domain/permission.js";
import { AuditRepository } from "./infrastructure/audit-repository.js";
import { AuditLogger } from "./infrastructure/audit-logger.js";
import { auditRoutes } from "./api/routes.js";
import { auditPermissions } from "./permissions/permissions.js";

export interface AuditModule {
  logger: IAuditLogger;
  repository: AuditRepository;
  permissions: PermissionDefinition[];
  routes(ctx: RouteContext): FastifyPluginAsync;
}

export function createAuditModule(): AuditModule {
  const repository = new AuditRepository();
  const logger = new AuditLogger(repository);
  return {
    logger,
    repository,
    permissions: auditPermissions,
    routes: (ctx) => auditRoutes(repository, ctx),
  };
}
