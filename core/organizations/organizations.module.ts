import { forwardRef, Module } from "@nestjs/common";
import { ORGANIZATION_PROVIDER } from "@core/kernel/tokens.js";
import { AuditModule } from "@core/audit/audit.module.js";
import { EventsModule } from "@core/events/events.module.js";
import { IdentityModule } from "@core/identity/identity.module.js";
import { OrganizationRepository } from "@core/organizations/infrastructure/organization-repository.js";
import { OrganizationProvider } from "@core/organizations/infrastructure/organization-provider.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { OrganizationsController } from "@core/organizations/api/organizations.controller.js";

/**
 * Organizations & Users (§7.4). An organization *is* the tenant
 * (§ docs/tenancy.md); `ORGANIZATION_PROVIDER` exposes membership lookups.
 * `forwardRef(IdentityModule)` breaks the identity ↔ organizations cycle.
 */
@Module({
  imports: [AuditModule, EventsModule, forwardRef(() => IdentityModule)],
  controllers: [OrganizationsController],
  providers: [
    OrganizationRepository,
    OrganizationProvider,
    OrganizationService,
    { provide: ORGANIZATION_PROVIDER, useExisting: OrganizationProvider },
  ],
  exports: [ORGANIZATION_PROVIDER],
})
export class OrganizationsModule {}
