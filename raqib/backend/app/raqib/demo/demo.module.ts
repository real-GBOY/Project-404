import { Module } from "@nestjs/common";
import { FilesModule, RbacModule } from "@core/index.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { FormsModule } from "@raqib/raqib/forms/forms.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { EvidenceModule } from "@raqib/raqib/evidence/evidence.module.js";
import { ActionsModule } from "@raqib/raqib/actions/actions.module.js";
import { ObservationsModule } from "@raqib/raqib/observations/observations.module.js";
import { TrainingModule } from "@raqib/raqib/training/training.module.js";
import { ReviewModule } from "@raqib/raqib/review/review.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { SettingsRepository } from "@raqib/raqib/settings/infrastructure/settings-repository.js";
import { DemoSeeder } from "./demo-seeder.js";

@Module({
  imports: [RbacModule, PeopleModule, ProjectsModule, SettingsModule, AccessModule, VisitsModule, FormsModule, InspectionsModule, EvidenceModule, ReviewModule, ObservationsModule, ActionsModule, TrainingModule, FilesModule],
  providers: [DemoSeeder, SettingsRepository],
  exports: [DemoSeeder],
})
export class DemoModule {}
