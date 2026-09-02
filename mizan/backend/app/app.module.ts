import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
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
import { LawfirmModule } from "@app/lawfirm/lawfirm.module.js";
import { DemoModule } from "@app/lawfirm/demo/demo.module.js";
import { AppSeedService } from "./seed.js";

/**
 * The Mizan client application — the composition root
 * (docs/integration-guide.md → "Using Core in a client project"). It imports the
 * Core feature modules it needs plus the law-firm product domain, and re-applies
 * the Core request-context middleware + exception filter (a NestModule's
 * `configure()` only runs for the root module, so this cannot be inherited from
 * Core's own `AppModule`).
 *
 * `main.ts` boots this, not `core/app.module.ts` (which stays as the fixture for
 * Core's own integration tests).
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
    LawfirmModule,
    DemoModule,
  ],
  controllers: [HealthController],
  providers: [
    SeedService,
    AppSeedService,
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
