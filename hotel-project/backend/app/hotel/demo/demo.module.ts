import { Module } from "@nestjs/common";
import { RbacModule } from "@core/index.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { GuestsModule } from "@hotel/hotel/guests/guests.module.js";
import { PricingModule } from "@hotel/hotel/pricing/pricing.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { BillingModule } from "@hotel/hotel/billing/billing.module.js";
import { HousekeepingModule } from "@hotel/hotel/housekeeping/housekeeping.module.js";
import { FrontDeskModule } from "@hotel/hotel/front-desk/front-desk.module.js";
import { MaintenanceModule } from "@hotel/hotel/maintenance/maintenance.module.js";
import { DemoHistory } from "./demo-history.js";
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
    BillingModule,
    HousekeepingModule,
    FrontDeskModule,
    MaintenanceModule,
  ],
  providers: [DemoSeeder, DemoHistory],
  exports: [DemoSeeder],
})
export class DemoModule {}
