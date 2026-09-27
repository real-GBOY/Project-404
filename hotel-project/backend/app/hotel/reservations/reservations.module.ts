import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { GuestsModule } from "@hotel/hotel/guests/guests.module.js";
import { PricingModule } from "@hotel/hotel/pricing/pricing.module.js";
import { ReservationsController } from "./api/reservations.controller.js";
import { AvailabilityService } from "./application/availability-service.js";
import { ReservationsService } from "./application/reservations-service.js";
import { ReservationsRepository } from "./infrastructure/reservations-repository.js";

@Module({
  imports: [
    AuditModule,
    EventsModule,
    HotelSharedModule,
    SettingsModule,
    RoomsModule,
    GuestsModule,
    PricingModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsRepository, ReservationsService, AvailabilityService],
  exports: [ReservationsRepository, ReservationsService, AvailabilityService],
})
export class ReservationsModule {}
