import { Module } from "@nestjs/common";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { FinanceModule } from "@atlas/realestate/finance/finance.module.js";
import { DashboardController } from "./api/dashboard.controller.js";
import { DashboardService } from "./application/dashboard-service.js";

@Module({
  imports: [PropertiesModule, CrmModule, FinanceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
