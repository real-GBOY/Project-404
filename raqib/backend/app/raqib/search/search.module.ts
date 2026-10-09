import { Module } from "@nestjs/common";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ActionsModule } from "@raqib/raqib/actions/actions.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { ObservationsModule } from "@raqib/raqib/observations/observations.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { ReportsModule } from "@raqib/raqib/reports/reports.module.js";
import { TrainingModule } from "@raqib/raqib/training/training.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { SearchController } from "./api/search.controller.js";
import { SearchService } from "./application/search-service.js";

@Module({
  imports: [AccessModule, ActionsModule, InspectionsModule, ObservationsModule, PeopleModule, ProjectsModule, ReportsModule, TrainingModule, VisitsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
