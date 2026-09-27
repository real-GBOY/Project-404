import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { PricingModule } from "@hotel/hotel/pricing/pricing.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { BillingModule } from "@hotel/hotel/billing/billing.module.js";
import { HousekeepingModule } from "@hotel/hotel/housekeeping/housekeeping.module.js";
import { FrontDeskController } from "./api/front-desk.controller.js";
import { FrontDeskService } from "./application/front-desk-service.js";

@Module({
  imports: [
    AuditModule,
    SettingsModule,
    RoomsModule,
    PricingModule,
    ReservationsModule,
    BillingModule,
    HousekeepingModule,
  ],
  controllers: [FrontDeskController],
  providers: [FrontDeskService],
  exports: [FrontDeskService],
})
export class FrontDeskModule {}
