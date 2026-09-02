import { Module } from "@nestjs/common";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { ClientsModule } from "@app/lawfirm/clients/clients.module.js";
import { MattersModule } from "@app/lawfirm/matters/matters.module.js";
import { HearingsModule } from "@app/lawfirm/hearings/hearings.module.js";
import { TasksModule } from "@app/lawfirm/tasks/tasks.module.js";
import { DocumentsModule } from "@app/lawfirm/documents/documents.module.js";
import { BillingModule } from "@app/lawfirm/billing/billing.module.js";
import { CalendarModule } from "@app/lawfirm/calendar/calendar.module.js";
import { StaffModule } from "@app/lawfirm/staff/staff.module.js";
import { AdminModule } from "@app/lawfirm/admin/admin.module.js";
import { DashboardModule } from "@app/lawfirm/dashboard/dashboard.module.js";
import { SettingsModule } from "@app/lawfirm/settings/settings.module.js";

/**
 * The Mizan law-firm product domain (Plan §10.1 `app/<domain>/`).
 *
 * Composes every feature area — clients, matters, hearings, tasks, documents,
 * billing, calendar, staff, dashboard, settings, plus the RBAC/audit adapter —
 * over the shared activity feed / directory / aggregate queries. Each area
 * follows the standard module anatomy and reaches Core only through the
 * provider contracts in `core/contracts` (§4), the one sanctioned exception
 * being the `admin` adapter + `seed.ts` reaching into `core/rbac`.
 */
@Module({
  imports: [
    LawfirmSharedModule,
    ClientsModule,
    MattersModule,
    HearingsModule,
    TasksModule,
    DocumentsModule,
    BillingModule,
    CalendarModule,
    StaffModule,
    AdminModule,
    DashboardModule,
    SettingsModule,
  ],
})
export class LawfirmModule {}
