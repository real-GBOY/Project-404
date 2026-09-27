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
import { HotelModule } from "@hotel/hotel/hotel.module.js";
import { DemoModule } from "@hotel/hotel/demo/demo.module.js";
import { AppSeedService } from "./seed.js";

/**
 * The HotelOS application — the composition root, mirroring `atlas/backend/app/app.module.ts`
 * and `mizan/backend/app/app.module.ts`. This is a SEPARATE deployment from both: its own
 * process, own port, own Postgres database, own users/organizations/roles — Core's *source*
 * is shared by relative import, nothing else is.
 *
 * Core modules are the ones HotelOS actually uses. `MessagingModule` (real-time chat) is
 * deliberately not imported: nothing in the hotel product needs it. Its tables still exist
 * because the copied Core baseline migrations are kept complete and identical to Core's.
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
    HotelModule,
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
    consumer.apply(RequestContextMiddleware).forRoutes("{*path}");
  }
}
