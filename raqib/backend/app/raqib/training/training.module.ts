import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { ReportsModule } from "@raqib/raqib/reports/reports.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { TrainingController } from "./api/training.controller.js";
import { GuardHistoryService } from "./application/guard-history-service.js";
import { TrainingService } from "./application/training-service.js";
import { TrainingRepository } from "./infrastructure/training-repository.js";

@Module({
  imports: [AuditModule, EventsModule, AccessModule, ProjectsModule, ReportsModule, SettingsModule, SharedModule],
  controllers: [TrainingController],
  providers: [TrainingRepository, TrainingService, GuardHistoryService],
  exports: [TrainingRepository, TrainingService],
})
export class TrainingModule {}
