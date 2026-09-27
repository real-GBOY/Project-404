import { Module } from "@nestjs/common";
import { RbacModule } from "@core/index.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { GuestsModule } from "@hotel/hotel/guests/guests.module.js";
import { PricingModule } from "@hotel/hotel/pricing/pricing.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { DemoSeeder } from "./demo-seeder.js";

/** Hosts the opt-in demo seeder; imports whichever modules the seeder drives. */
@Module({
  imports: [
    RbacModule,
    SettingsModule,
    RoomsModule,
    GuestsModule,
    PricingModule,
    ReservationsModule,
  ],
  providers: [DemoSeeder],
  exports: [DemoSeeder],
})
export class DemoModule {}
