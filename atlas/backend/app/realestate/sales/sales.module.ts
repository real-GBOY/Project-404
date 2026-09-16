import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { ReservationsController } from "./api/reservations.controller.js";
import { ReservationsRepository } from "./infrastructure/reservations-repository.js";
import { ReservationsService } from "./application/reservations-service.js";
import { ContractsController } from "./api/contracts.controller.js";
import { ContractsRepository } from "./infrastructure/contracts-repository.js";
import { ContractsService } from "./application/contracts-service.js";
import { PaymentPlansController, InstallmentsController } from "./api/payment-plans.controller.js";
import { PaymentPlansRepository } from "./infrastructure/payment-plans-repository.js";
import { PaymentPlansService } from "./application/payment-plans-service.js";
import { CommissionsController } from "./api/commissions.controller.js";
import { CommissionsRepository } from "./infrastructure/commissions-repository.js";
import { CommissionsService } from "./application/commissions-service.js";

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
