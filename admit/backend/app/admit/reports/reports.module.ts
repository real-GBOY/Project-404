import { Module } from "@nestjs/common";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { ReportsController } from "./api/reports.controller.js";
import { ReportsService } from "./application/reports-service.js";

/** Sales, payment-queue, attendance and delivery aggregates for the dashboard. */
@Module({
  imports: [AdmitEventsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
