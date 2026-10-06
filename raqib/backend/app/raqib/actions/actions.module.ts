import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { ObservationsModule } from "@raqib/raqib/observations/observations.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { ActionsController } from "./api/actions.controller.js";
import { ActionsService } from "./application/actions-service.js";
import { ActionsRepository } from "./infrastructure/actions-repository.js";

@Module({
  imports: [AuditModule, EventsModule, AccessModule, InspectionsModule, ObservationsModule, ProjectsModule, SharedModule, VisitsModule],
  controllers: [ActionsController],
  providers: [ActionsRepository, ActionsService],
  exports: [ActionsRepository, ActionsService],
})
export class ActionsModule {}
