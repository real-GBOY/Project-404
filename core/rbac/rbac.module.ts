import { Module, type OnModuleInit } from "@nestjs/common";
import { PERMISSION_PROVIDER } from "@core/kernel/tokens.js";
import { AuditModule } from "@core/audit/audit.module.js";
import { EventsModule } from "@core/events/events.module.js";
import { EventRegistry } from "@core/events/registry.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { RbacPermissionProvider } from "@core/rbac/infrastructure/permission-provider.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { RbacController } from "@core/rbac/api/rbac.controller.js";
import { registerRbacSubscribers } from "@core/rbac/events/subscribers.js";

/**
 * RBAC (§7.2). `PERMISSION_PROVIDER` is the `IPermissionProvider` the HTTP
 * guards and every module use to answer "can this user do this?", resolved
 * within the active tenant (§ docs/tenancy.md).
 */
@Module({
  imports: [AuditModule, EventsModule],
  controllers: [RbacController],
  providers: [
    RbacRepository,
    RbacPermissionProvider,
    RbacService,
    { provide: PERMISSION_PROVIDER, useExisting: RbacPermissionProvider },
  ],
  exports: [PERMISSION_PROVIDER, RbacService, RbacRepository],
})
export class RbacModule implements OnModuleInit {
  constructor(
    private readonly registry: EventRegistry,
    private readonly service: RbacService,
  ) {}

  onModuleInit(): void {
    registerRbacSubscribers(this.registry, this.service);
  }
}
