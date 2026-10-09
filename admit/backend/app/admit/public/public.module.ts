import { Module } from "@nestjs/common";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { BookingsStoreModule } from "@admit/admit/bookings/bookings-store.module.js";
import { BookingsModule } from "@admit/admit/bookings/bookings.module.js";
import { PaymentsModule } from "@admit/admit/payments/payments.module.js";
import { EmailsModule } from "@admit/admit/emails/emails.module.js";
import { SettingsModule } from "@admit/admit/settings/settings.module.js";
import { PublicController } from "./api/public.controller.js";
import { PublicService } from "./application/public-service.js";
import { RateLimiter } from "./infrastructure/rate-limiter.js";

/** The customer API for the public site (see PublicController): catalogue, guest checkout, proof upload, tickets, QR. */
@Module({
  imports: [AdmitEventsModule, BookingsStoreModule, BookingsModule, PaymentsModule, EmailsModule, SettingsModule],
  controllers: [PublicController],
  providers: [PublicService, RateLimiter],
  exports: [RateLimiter],
})
export class PublicModule {}
