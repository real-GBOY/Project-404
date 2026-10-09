import { Module } from "@nestjs/common";
import { FilesModule } from "@core/index.js";
import { SettingsModule } from "@admit/admit/settings/settings.module.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { BookingsModule } from "@admit/admit/bookings/bookings.module.js";
import { PaymentsModule } from "@admit/admit/payments/payments.module.js";
import { CheckinModule } from "@admit/admit/checkin/checkin.module.js";
import { StaffModule } from "@admit/admit/staff/staff.module.js";
import { PublicModule } from "@admit/admit/public/public.module.js";
import { DemoSeeder } from "./demo-seeder.js";

/** The opt-in demo organizer (see DemoSeeder). Imported by the app module only. */
@Module({
  imports: [FilesModule, SettingsModule, AdmitEventsModule, BookingsModule, PaymentsModule, CheckinModule, StaffModule, PublicModule],
  providers: [DemoSeeder],
  exports: [DemoSeeder],
})
export class DemoModule {}
