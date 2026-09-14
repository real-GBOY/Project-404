import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { LeadsController } from "./leads.controller.js";
import { LeadsRepository } from "./leads-repository.js";
import { LeadsService } from "./leads-service.js";
import { CustomersController } from "./customers.controller.js";
import { CustomersRepository } from "./customers-repository.js";
import { CustomersService } from "./customers-service.js";
import { ActivitiesController } from "./activities.controller.js";
import { ActivitiesRepository } from "./activities-repository.js";
import { ActivitiesService } from "./activities-service.js";
import { FollowupsController } from "./followups.controller.js";
import { FollowupsRepository } from "./followups-repository.js";
import { FollowupsService } from "./followups-service.js";

@Module({
  imports: [AuditModule, EventsModule],
  controllers: [LeadsController, CustomersController, ActivitiesController, FollowupsController],
  providers: [
    LeadsRepository,
    LeadsService,
    CustomersRepository,
    CustomersService,
    ActivitiesRepository,
    ActivitiesService,
    FollowupsRepository,
    FollowupsService,
  ],
  exports: [LeadsRepository, LeadsService, CustomersRepository, CustomersService, ActivitiesRepository],
})
export class CrmModule {}
