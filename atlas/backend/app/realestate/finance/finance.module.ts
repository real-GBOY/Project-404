import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { SalesModule } from "@atlas/realestate/sales/sales.module.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsRepository } from "./payments-repository.js";
import { PaymentsService } from "./payments-service.js";
import { FinanceQueries } from "./finance-queries.js";
import { FinancialReportsController } from "./financial-reports.controller.js";
import { FinancialReportsRepository } from "./financial-reports-repository.js";
import { FinancialReportsService } from "./financial-reports-service.js";

@Module({
  imports: [SalesModule, AuditModule],
  controllers: [PaymentsController, FinancialReportsController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    FinanceQueries,
    FinancialReportsRepository,
    FinancialReportsService,
  ],
  exports: [PaymentsRepository, PaymentsService, FinanceQueries],
})
export class FinanceModule {}
