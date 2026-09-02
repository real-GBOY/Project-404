import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { KernelModule } from "@core/kernel/kernel.module.js";
import { EventsModule } from "@core/events/events.module.js";
import { AuditModule } from "@core/audit/audit.module.js";
import { RbacModule } from "@core/rbac/rbac.module.js";
import { IdentityModule } from "@core/identity/identity.module.js";
import { OrganizationsModule } from "@core/organizations/organizations.module.js";
import { NotificationsModule } from "@core/notifications/notifications.module.js";
import { FilesModule } from "@core/files/files.module.js";
import { SecurityModule } from "@core/http/security.module.js";
import { AppExceptionFilter } from "@core/http/app-exception.filter.js";
import { RequestContextMiddleware } from "@core/http/request-context.middleware.js";
import { HealthController } from "@core/observability/health.controller.js";
import { SeedService } from "@core/bootstrap/seed.service.js";

/**
 * The composition root (§3.4) — the modular monolith (§3.0) as one Nest app:
 * one deployable, strict module boundaries, no network hops between modules.
 */
@Module({
  imports: [
    KernelModule,
    EventsModule,
    AuditModule,
    RbacModule,
    IdentityModule,
    OrganizationsModule,
    NotificationsModule,
    FilesModule,
    SecurityModule,
  ],
  controllers: [HealthController],
  providers: [
    SeedService,
    RequestContextMiddleware,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Binds the correlation id + locale before guards and controllers.
    consumer.apply(RequestContextMiddleware).forRoutes("{*path}");
  }
}
