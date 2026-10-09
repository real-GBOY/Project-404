import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { BookingsStoreModule } from "@admit/admit/bookings/bookings-store.module.js";
import { CheckinController } from "./api/checkin.controller.js";
import { CheckinService } from "./application/checkin-service.js";

/** Door check-in: the atomic VALID -> USED scan, the scan log, and the live attendance overview. */
@Module({
  imports: [IdentityModule, BookingsStoreModule, AdmitEventsModule],
  controllers: [CheckinController],
  providers: [CheckinService],
  exports: [CheckinService],
})
export class CheckinModule {}
