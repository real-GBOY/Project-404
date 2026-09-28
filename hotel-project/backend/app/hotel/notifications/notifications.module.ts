import { Module } from "@nestjs/common";
import { EventsModule, IdentityModule, NotificationsModule, RbacModule } from "@core/index.js";
import { HousekeepingModule } from "@hotel/hotel/housekeeping/housekeeping.module.js";
import { MaintenanceModule } from "@hotel/hotel/maintenance/maintenance.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { BillingModule } from "@hotel/hotel/billing/billing.module.js";
import { HotelNotifications } from "./hotel-notifications.js";

/** Staff notifications for hotel events (see HotelNotifications). Delivery is Core's. */
@Module({
  imports: [
    EventsModule,
    IdentityModule,
    NotificationsModule,
    RbacModule,
    HousekeepingModule,
    MaintenanceModule,
    ReservationsModule,
    BillingModule,
  ],
  providers: [HotelNotifications],
})
export class HotelNotificationsModule {}
