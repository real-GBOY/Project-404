import { Module } from "@nestjs/common";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { AnalyticsController } from "./api/analytics.controller.js";
import { AnalyticsService } from "./application/analytics-service.js";
import { AnalyticsRepository } from "./infrastructure/analytics-repository.js";

@Module({
  imports: [SettingsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService],
  exports: [AnalyticsRepository],
})
export class AnalyticsModule {}
