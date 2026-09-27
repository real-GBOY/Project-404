import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { SettingsController } from "./api/settings.controller.js";
import { SettingsService } from "./application/settings-service.js";
import { SettingsRepository } from "./infrastructure/settings-repository.js";

@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
