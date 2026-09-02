import { Module } from "@nestjs/common";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { MattersModule } from "@app/lawfirm/matters/matters.module.js";
import { HearingsModule } from "@app/lawfirm/hearings/hearings.module.js";
import { TasksModule } from "@app/lawfirm/tasks/tasks.module.js";
import { DocumentsModule } from "@app/lawfirm/documents/documents.module.js";
import { BillingModule } from "@app/lawfirm/billing/billing.module.js";
import { CalendarModule } from "@app/lawfirm/calendar/calendar.module.js";
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
