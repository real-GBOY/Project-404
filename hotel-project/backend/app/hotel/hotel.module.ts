import { Module } from "@nestjs/common";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { StaffModule } from "@hotel/hotel/staff/staff.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { GuestsModule } from "@hotel/hotel/guests/guests.module.js";
import { PricingModule } from "@hotel/hotel/pricing/pricing.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { BillingModule } from "@hotel/hotel/billing/billing.module.js";
import { HousekeepingModule } from "@hotel/hotel/housekeeping/housekeeping.module.js";
import { FrontDeskModule } from "@hotel/hotel/front-desk/front-desk.module.js";
import { MaintenanceModule } from "@hotel/hotel/maintenance/maintenance.module.js";
import { DashboardModule } from "@hotel/hotel/dashboard/dashboard.module.js";

/**
 * The HotelOS product domain (mirrors `atlas/backend/app/realestate/realestate.module.ts`).
 * Composes every hotel feature module over the shared infrastructure. Each module reaches Core
 * only through the provider contracts in `core/contracts` and the documented Core services;
 * hotel-specific behaviour never moves into Core. Architecture: `docs/architecture.md`.
 */
@Module({
  imports: [
    HotelSharedModule,
    SettingsModule,
    StaffModule,
    RoomsModule,
    GuestsModule,
    PricingModule,
    ReservationsModule,
    BillingModule,
    HousekeepingModule,
    FrontDeskModule,
    MaintenanceModule,
    DashboardModule,
  ],
})
export class HotelModule {}
