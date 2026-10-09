import { Module } from "@nestjs/common";
import { PaymentsRepository } from "@admit/admit/payments/infrastructure/payments-repository.js";
import { TicketsRepository } from "@admit/admit/tickets/infrastructure/tickets-repository.js";
import { EmailRepository } from "@admit/admit/emails/infrastructure/email-repository.js";
import { BookingsRepository } from "./infrastructure/bookings-repository.js";

/**
 * The persistence layer of the booking lifecycle: bookings, payment submissions, tickets and the email outbox.
 * Repositories only - no services - so the feature modules (bookings, payments, tickets, check-in, emails) can all
 * depend on it without depending on each other in a cycle.
 */
@Module({
  providers: [BookingsRepository, PaymentsRepository, TicketsRepository, EmailRepository],
  exports: [BookingsRepository, PaymentsRepository, TicketsRepository, EmailRepository],
})
export class BookingsStoreModule {}
