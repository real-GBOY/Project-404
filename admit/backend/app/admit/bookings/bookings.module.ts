import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { EmailsModule } from "@admit/admit/emails/emails.module.js";
import { BookingsStoreModule } from "./bookings-store.module.js";
import { BookingsController } from "./api/bookings.controller.js";
import { BookingsService } from "./application/bookings-service.js";

/** The booking lifecycle: guest checkout with an inventory hold, magic-link access, cancellation and hold expiry. */
@Module({
  imports: [AuditModule, BookingsStoreModule, AdmitEventsModule, EmailsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
