import { Module } from "@nestjs/common";
import { AuditModule, EventsModule, RbacModule } from "@core/index.js";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { BillingController } from "./api/billing.controller.js";
import { BillingService } from "./application/billing-service.js";
import { PAYMENT_PROVIDER } from "./domain/payment-provider.js";
import { BillingRepository } from "./infrastructure/billing-repository.js";
import { SimulatedPaymentProvider } from "./infrastructure/simulated-payment-provider.js";

/**
 * Billing. The payment gateway is ONE binding: swap `SimulatedPaymentProvider` for a
 * `PaymobPaymentProvider` here and nothing else in the domain changes.
 */
@Module({
  imports: [
    AuditModule,
    EventsModule,
    RbacModule,
    HotelSharedModule,
    SettingsModule,
    ReservationsModule,
  ],
  controllers: [BillingController],
  providers: [
    BillingRepository,
    BillingService,
    { provide: PAYMENT_PROVIDER, useClass: SimulatedPaymentProvider },
  ],
  exports: [BillingRepository, BillingService],
})
export class BillingModule {}
