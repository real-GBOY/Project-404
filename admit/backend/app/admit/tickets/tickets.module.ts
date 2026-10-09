import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { BookingsStoreModule } from "@admit/admit/bookings/bookings-store.module.js";
import { TicketsController } from "./api/tickets.controller.js";
import { TicketsService } from "./application/tickets-service.js";

/** Issued tickets: idempotent issuance (called from payment approval), lookup and revocation. */
@Module({
  imports: [AuditModule, BookingsStoreModule, AdmitEventsModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
