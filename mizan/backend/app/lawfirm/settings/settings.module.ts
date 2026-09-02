import { Module } from "@nestjs/common";
import { AuditModule, OrganizationsModule } from "@core/index.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsRepository } from "./settings-repository.js";
import { SettingsService } from "./settings-service.js";

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [SettingsController],
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
