import { Module } from "@nestjs/common";
import { AuditModule, FilesModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { BookingsStoreModule } from "@admit/admit/bookings/bookings-store.module.js";
import { BookingsModule } from "@admit/admit/bookings/bookings.module.js";
import { EmailsModule } from "@admit/admit/emails/emails.module.js";
import { TicketsModule } from "@admit/admit/tickets/tickets.module.js";
import { PaymentsController } from "./api/payments.controller.js";
import { PaymentsService } from "./application/payments-service.js";

/** Manual payment verification: proof upload by the customer, review queue, version-checked approve/reject. */
@Module({
  imports: [AuditModule, FilesModule, BookingsStoreModule, AdmitEventsModule, BookingsModule, EmailsModule, TicketsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
