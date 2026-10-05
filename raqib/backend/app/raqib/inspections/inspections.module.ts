import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { EvidenceRepository } from "@raqib/raqib/evidence/infrastructure/evidence-repository.js";
import { FormsModule } from "@raqib/raqib/forms/forms.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { InspectionsController } from "./api/inspections.controller.js";
import { InspectionsService } from "./application/inspections-service.js";
import { InspectionsRepository } from "./infrastructure/inspections-repository.js";

@Module({
  imports: [AuditModule, EventsModule, AccessModule, FormsModule, PeopleModule, ProjectsModule, SettingsModule, VisitsModule],
  controllers: [InspectionsController],
  providers: [InspectionsRepository, EvidenceRepository, InspectionsService],
  exports: [InspectionsRepository, EvidenceRepository, InspectionsService],
})
export class InspectionsModule {}
