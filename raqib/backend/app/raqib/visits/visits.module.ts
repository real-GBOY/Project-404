import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { FormsModule } from "@raqib/raqib/forms/forms.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { VisitsController } from "./api/visits.controller.js";
import { VisitsService } from "./application/visits-service.js";
import { VisitsRepository } from "./infrastructure/visits-repository.js";

@Module({
  imports: [AuditModule, EventsModule, AccessModule, FormsModule, PeopleModule, ProjectsModule, SettingsModule, SharedModule],
  controllers: [VisitsController],
  providers: [VisitsRepository, VisitsService],
  exports: [VisitsRepository, VisitsService],
})
export class VisitsModule {}
