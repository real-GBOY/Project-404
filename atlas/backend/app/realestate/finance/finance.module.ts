import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { SalesModule } from "@atlas/realestate/sales/sales.module.js";
import { PaymentsController } from "./api/payments.controller.js";
import { PaymentsRepository } from "./infrastructure/payments-repository.js";
import { PaymentsService } from "./application/payments-service.js";
import { FinanceQueries } from "./infrastructure/finance-queries.js";
import { FinancialReportsController } from "./api/financial-reports.controller.js";
import { FinancialReportsRepository } from "./infrastructure/financial-reports-repository.js";
import { FinancialReportsService } from "./application/financial-reports-service.js";

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
