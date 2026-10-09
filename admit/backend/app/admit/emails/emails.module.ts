import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { SettingsModule } from "@admit/admit/settings/settings.module.js";
import { BookingsStoreModule } from "@admit/admit/bookings/bookings-store.module.js";
import { EmailsController } from "./api/emails.controller.js";
import { EmailComposer } from "./application/email-composer.js";
import { EmailsService } from "./application/emails-service.js";

/**
 * Transactional email, outbox side: the composer builds each email's final payload and queues it in the caller's
 * transaction; the Python worker (admit/worker) delivers. This module also serves delivery status and retry.
 */
@Module({
  imports: [AuditModule, BookingsStoreModule, AdmitEventsModule, SettingsModule],
  controllers: [EmailsController],
  providers: [EmailComposer, EmailsService],
  exports: [EmailComposer],
})
export class EmailsModule {}
