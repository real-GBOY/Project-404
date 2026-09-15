import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { ReservationsController } from "./reservations.controller.js";
import { ReservationsRepository } from "./reservations-repository.js";
import { ReservationsService } from "./reservations-service.js";
import { ContractsController } from "./contracts.controller.js";
import { ContractsRepository } from "./contracts-repository.js";
import { ContractsService } from "./contracts-service.js";
import { PaymentPlansController, InstallmentsController } from "./payment-plans.controller.js";
import { PaymentPlansRepository } from "./payment-plans-repository.js";
import { PaymentPlansService } from "./payment-plans-service.js";
import { CommissionsController } from "./commissions.controller.js";
import { CommissionsRepository } from "./commissions-repository.js";
import { CommissionsService } from "./commissions-service.js";

@Module({
  imports: [PropertiesModule, CrmModule, AuditModule, EventsModule],
  controllers: [ReservationsController, ContractsController, PaymentPlansController, InstallmentsController, CommissionsController],
  providers: [
    ReservationsRepository,
    ReservationsService,
    ContractsRepository,
    ContractsService,
    PaymentPlansRepository,
    PaymentPlansService,
    CommissionsRepository,
    CommissionsService,
  ],
  exports: [
    ReservationsRepository,
    ReservationsService,
    ContractsRepository,
    ContractsService,
    PaymentPlansRepository,
    PaymentPlansService,
    CommissionsRepository,
    CommissionsService,
  ],
})
export class SalesModule {}
