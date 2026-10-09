import { Module } from "@nestjs/common";
import { AuditModule, RbacModule } from "@core/index.js";
import { EventsController } from "./api/events.controller.js";
import { EventAccess } from "./application/event-access.js";
import { EventsService } from "./application/events-service.js";
import { EventsRepository } from "./infrastructure/events-repository.js";

/** The event catalogue: venues, events, ticket types, manual payment instructions, and per-event staff reach. */
@Module({
  imports: [AuditModule, RbacModule],
  controllers: [EventsController],
  providers: [EventsRepository, EventAccess, EventsService],
  exports: [EventsRepository, EventAccess, EventsService],
})
export class AdmitEventsModule {}
