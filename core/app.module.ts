import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { KernelModule } from "./kernel/kernel.module.js";
import { EventsModule } from "./events/events.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { RbacModule } from "./rbac/rbac.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { FilesModule } from "./files/files.module.js";
import { SecurityModule } from "./http/security.module.js";
import { AppExceptionFilter } from "./http/app-exception.filter.js";
import { RequestContextMiddleware } from "./http/request-context.middleware.js";
import { HealthController } from "./observability/health.controller.js";
import { SeedService } from "./bootstrap/seed.service.js";

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
