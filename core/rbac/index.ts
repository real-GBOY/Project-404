import type { Router } from "express";
import type { UnitOfWork } from "../kernel/db/db.js";
import type { IAuditLogger, IPermissionProvider } from "../contracts/index.js";
import type { RouteContext } from "../http/route-context.js";
import type { PermissionDefinition } from "./domain/permission.js";
import { RbacRepository } from "./infrastructure/rbac-repository.js";
import { RbacPermissionProvider } from "./infrastructure/permission-provider.js";
import { RbacService } from "./application/rbac-service.js";
import { seedRbac } from "./application/seed.js";
import { rbacRoutes } from "./api/routes.js";
import { rbacPermissions } from "./permissions/permissions.js";

export interface RbacModuleDeps {
  uow: UnitOfWork;
  audit: IAuditLogger;
}

export interface RbacModule {
  service: RbacService;
  permissionProvider: IPermissionProvider;
  permissions: PermissionDefinition[];
  seed(allModulePermissions: PermissionDefinition[]): Promise<void>;
  routes(ctx: RouteContext): Router;
}

export function createRbacModule(deps: RbacModuleDeps): RbacModule {
  const repo = new RbacRepository();
  const permissionProvider = new RbacPermissionProvider(repo);
  const service = new RbacService({ repo, audit: deps.audit, uow: deps.uow });

  return {
    service,
    permissionProvider,
    permissions: rbacPermissions,
    seed: (all) => seedRbac(repo, deps.uow, all),
    routes: (ctx) => rbacRoutes(service, ctx),
  };
}
