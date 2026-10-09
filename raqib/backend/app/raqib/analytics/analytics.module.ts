import { Module } from "@nestjs/common";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ActionsModule } from "@raqib/raqib/actions/actions.module.js";
import { ConfidentialModule } from "@raqib/raqib/confidential/confidential.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { ObservationsModule } from "@raqib/raqib/observations/observations.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { ReportsModule } from "@raqib/raqib/reports/reports.module.js";
import { TrainingModule } from "@raqib/raqib/training/training.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { AnalyticsController } from "./api/analytics.controller.js";
import { AnalyticsService } from "./application/analytics-service.js";

@Module({
  imports: [ConfidentialModule, SettingsModule, AccessModule, ActionsModule, ObservationsModule, ProjectsModule, ReportsModule, TrainingModule, VisitsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
