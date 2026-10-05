import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import {
  KernelModule,
  EventsModule,
  AuditModule,
  RbacModule,
  IdentityModule,
  OrganizationsModule,
  NotificationsModule,
  FilesModule,
  SecurityModule,
  SeedService,
} from "@core/index.js";
import { AppExceptionFilter } from "@core/http/app-exception.filter.js";
import { RequestContextMiddleware } from "@core/http/request-context.middleware.js";
import { HealthController } from "@core/observability/health.controller.js";
import { LifecycleModule } from "@raqib/raqib/lifecycle/lifecycle.module.js";
import { RaqibModule } from "@raqib/raqib/raqib.module.js";
import { DemoModule } from "@raqib/raqib/demo/demo.module.js";
import { RateLimitGuard } from "@raqib/raqib/security/rate-limit.js";
import { ERROR_TRACKER } from "@core/kernel/tokens.js";
import { AlertingErrorTracker } from "@raqib/raqib/observability/alerts.js";
import { MetricsMiddleware } from "@raqib/raqib/observability/metrics.middleware.js";
import { ObservabilityModule } from "@raqib/raqib/observability/observability.module.js";
import { SecurityHeadersMiddleware } from "@raqib/raqib/security/security-headers.middleware.js";
import { AppSeedService } from "./seed.js";

/**
 * The Raqib application — the composition root, mirroring `hotel-project/backend/app/app.module.ts`.
 * This is a SEPARATE deployment from Mizan, Atlas and HotelOS: its own process, own port, own Postgres
 * database, own users/organizations/roles — Core's *source* is shared by relative import, nothing else.
 *
 * `MessagingModule` (real-time chat) and the AI assistant are deliberately not imported: nothing in
 * Raqib needs them. Their tables still exist because the copied Core baseline migrations are kept
 * complete and identical to Core's.
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
    RaqibModule,
    LifecycleModule,
    ObservabilityModule,
    DemoModule,
  ],
  controllers: [HealthController],
  providers: [
    SeedService,
    AppSeedService,
    RequestContextMiddleware,
    { provide: ERROR_TRACKER, useExisting: AlertingErrorTracker },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, SecurityHeadersMiddleware, MetricsMiddleware).forRoutes("{*path}");
  }
}
