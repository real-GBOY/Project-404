import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { ProjectsController } from "./api/projects.controller.js";
import { ProjectsRepository } from "./infrastructure/projects-repository.js";
import { ProjectsService } from "./application/projects-service.js";
import { BuildingsController } from "./api/buildings.controller.js";
import { BuildingsRepository } from "./infrastructure/buildings-repository.js";
import { BuildingsService } from "./application/buildings-service.js";
import { UnitsController } from "./api/units.controller.js";
import { UnitsRepository } from "./infrastructure/units-repository.js";
import { UnitsService } from "./application/units-service.js";
import { PriceListsController } from "./api/price-lists.controller.js";
import { PriceListsRepository } from "./infrastructure/price-lists-repository.js";
import { PriceListsService } from "./application/price-lists-service.js";

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
