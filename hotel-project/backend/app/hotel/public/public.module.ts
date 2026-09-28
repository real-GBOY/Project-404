import { Module } from "@nestjs/common";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { GuestsModule } from "@hotel/hotel/guests/guests.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { PublicBookingController } from "./api/public-booking.controller.js";
import { PublicBookingService } from "./application/public-booking-service.js";
import { RateLimiter } from "./infrastructure/rate-limiter.js";

/** The public booking API for the hotel's own website (see PublicBookingController). */
@Module({
  imports: [SettingsModule, RoomsModule, GuestsModule, ReservationsModule],
  controllers: [PublicBookingController],
  providers: [PublicBookingService, RateLimiter],
  exports: [RateLimiter],
})
export class PublicModule {}
