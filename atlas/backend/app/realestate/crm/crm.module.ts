import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { LeadsController } from "./api/leads.controller.js";
import { LeadsRepository } from "./infrastructure/leads-repository.js";
import { LeadsService } from "./application/leads-service.js";
import { CustomersController } from "./api/customers.controller.js";
import { CustomersRepository } from "./infrastructure/customers-repository.js";
import { CustomersService } from "./application/customers-service.js";
import { ActivitiesController } from "./api/activities.controller.js";
import { ActivitiesRepository } from "./infrastructure/activities-repository.js";
import { ActivitiesService } from "./application/activities-service.js";
import { FollowupsController } from "./api/followups.controller.js";
import { FollowupsRepository } from "./infrastructure/followups-repository.js";
import { FollowupsService } from "./application/followups-service.js";

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
  exports: [LeadsRepository, LeadsService, CustomersRepository, CustomersService, ActivitiesRepository, ActivitiesService],
})
export class CrmModule {}
