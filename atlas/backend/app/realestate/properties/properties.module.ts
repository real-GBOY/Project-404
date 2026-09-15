import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsRepository } from "./projects-repository.js";
import { ProjectsService } from "./projects-service.js";
import { BuildingsController } from "./buildings.controller.js";
import { BuildingsRepository } from "./buildings-repository.js";
import { BuildingsService } from "./buildings-service.js";
import { UnitsController } from "./units.controller.js";
import { UnitsRepository } from "./units-repository.js";
import { UnitsService } from "./units-service.js";
import { PriceListsController } from "./price-lists.controller.js";
import { PriceListsRepository } from "./price-lists-repository.js";
import { PriceListsService } from "./price-lists-service.js";

@Module({
  imports: [AuditModule, EventsModule],
  controllers: [ProjectsController, BuildingsController, UnitsController, PriceListsController],
  providers: [
    ProjectsRepository,
    ProjectsService,
    BuildingsRepository,
    BuildingsService,
    UnitsRepository,
    UnitsService,
    PriceListsRepository,
    PriceListsService,
  ],
  exports: [ProjectsRepository, ProjectsService, BuildingsRepository, BuildingsService, UnitsRepository, UnitsService],
})
export class PropertiesModule {}
