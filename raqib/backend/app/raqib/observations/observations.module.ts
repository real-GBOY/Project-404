import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { ObservationsController } from "./api/observations.controller.js";
import { ObservationsService } from "./application/observations-service.js";
import { ObservationsRepository } from "./infrastructure/observations-repository.js";

@Module({
  imports: [AuditModule, AccessModule, ProjectsModule, SharedModule, VisitsModule],
  controllers: [ObservationsController],
  providers: [ObservationsRepository, ObservationsService],
  exports: [ObservationsRepository, ObservationsService],
})
export class ObservationsModule {}
