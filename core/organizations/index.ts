import type { Router } from "express";
import type { UnitOfWork } from "../kernel/db/db.js";
import type { IAuditLogger, IEventBus, IOrganizationProvider, IUserProvider } from "../contracts/index.js";
import type { RouteContext } from "../http/route-context.js";
import type { PermissionDefinition } from "../rbac/domain/permission.js";
import { OrganizationRepository } from "./infrastructure/organization-repository.js";
import { OrganizationProvider } from "./infrastructure/organization-provider.js";
import { OrganizationService } from "./application/organization-service.js";
import { organizationRoutes } from "./api/routes.js";
import { organizationPermissions } from "./permissions/permissions.js";

export interface OrganizationsModuleDeps {
  uow: UnitOfWork;
  users: IUserProvider;
  audit: IAuditLogger;
  events: IEventBus;
}

export interface OrganizationsModule {
  service: OrganizationService;
  organizationProvider: IOrganizationProvider;
  permissions: PermissionDefinition[];
  routes(ctx: RouteContext): Router;
}

export function createOrganizationsModule(deps: OrganizationsModuleDeps): OrganizationsModule {
  const repo = new OrganizationRepository();
  const service = new OrganizationService({
    repo,
    users: deps.users,
    audit: deps.audit,
    events: deps.events,
    uow: deps.uow,
  });
  return {
    service,
    organizationProvider: new OrganizationProvider(repo),
    permissions: organizationPermissions,
    routes: (ctx) => organizationRoutes(service, ctx),
  };
}
