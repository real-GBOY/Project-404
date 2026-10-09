import { Module } from "@nestjs/common";
import { AuditModule, FilesModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { ObservationsModule } from "@raqib/raqib/observations/observations.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { ReportsController } from "./api/reports.controller.js";
import { ReportsService } from "./application/reports-service.js";
import { ReportsRepository } from "./infrastructure/reports-repository.js";

@Module({
  imports: [SharedModule, AuditModule, FilesModule, AccessModule, InspectionsModule, ObservationsModule, ProjectsModule, VisitsModule],
  controllers: [ReportsController],
  providers: [ReportsRepository, ReportsService],
  exports: [ReportsService, ReportsRepository],
})
export class ReportsModule {}
