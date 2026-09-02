import { Module } from "@nestjs/common";
import { LawfirmSharedModule } from "./shared/shared.module.js";
import { ClientsModule } from "./clients/clients.module.js";
import { MattersModule } from "./matters/matters.module.js";
import { HearingsModule } from "./hearings/hearings.module.js";
import { TasksModule } from "./tasks/tasks.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { CalendarModule } from "./calendar/calendar.module.js";
import { StaffModule } from "./staff/staff.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { SettingsModule } from "./settings/settings.module.js";

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
