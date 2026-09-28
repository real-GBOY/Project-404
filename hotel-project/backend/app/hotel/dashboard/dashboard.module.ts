import { Module } from "@nestjs/common";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { BillingModule } from "@hotel/hotel/billing/billing.module.js";
import { AnalyticsModule } from "@hotel/hotel/analytics/analytics.module.js";
import { DashboardController } from "./api/dashboard.controller.js";
import { DashboardService } from "./application/dashboard-service.js";
import { DashboardRepository } from "./infrastructure/dashboard-repository.js";

@Module({
  imports: [SettingsModule, RoomsModule, BillingModule, AnalyticsModule],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
