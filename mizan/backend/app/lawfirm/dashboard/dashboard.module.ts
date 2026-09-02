import { Module } from "@nestjs/common";
import { LawfirmSharedModule } from "../shared/shared.module.js";
import { MattersModule } from "../matters/matters.module.js";
import { HearingsModule } from "../hearings/hearings.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { BillingModule } from "../billing/billing.module.js";
import { CalendarModule } from "../calendar/calendar.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard-service.js";

@Module({
  imports: [
    LawfirmSharedModule,
    MattersModule,
    HearingsModule,
    TasksModule,
    DocumentsModule,
    BillingModule,
    CalendarModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
