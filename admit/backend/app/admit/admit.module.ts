import { Module } from "@nestjs/common";
import { AdmitSharedModule } from "@admit/admit/shared/shared.module.js";
import { SettingsModule } from "@admit/admit/settings/settings.module.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { BookingsModule } from "@admit/admit/bookings/bookings.module.js";
import { PaymentsModule } from "@admit/admit/payments/payments.module.js";
import { TicketsModule } from "@admit/admit/tickets/tickets.module.js";
import { CheckinModule } from "@admit/admit/checkin/checkin.module.js";
import { EmailsModule } from "@admit/admit/emails/emails.module.js";
import { PublicModule } from "@admit/admit/public/public.module.js";
import { StaffModule } from "@admit/admit/staff/staff.module.js";
import { ReportsModule } from "@admit/admit/reports/reports.module.js";
import { JobsModule } from "@admit/admit/jobs/jobs.module.js";

/**
 * The Admit product domain (mirrors `HotelModule` / `RaqibModule`). Composes every Admit feature
 * module over Core. Each module reaches Core only through its provider contracts and documented
 * services; Admit behaviour never moves into Core. Architecture: `admit/docs/architecture.md`.
 */
@Module({
  imports: [
    AdmitSharedModule,
    SettingsModule,
    AdmitEventsModule,
    BookingsModule,
    PaymentsModule,
    TicketsModule,
    CheckinModule,
    EmailsModule,
    PublicModule,
    JobsModule,
    StaffModule,
    ReportsModule,
  ],
})
export class AdmitModule {}
