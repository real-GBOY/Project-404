import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { SettingsService } from "./application/settings-service.js";
import { SettingsRepository } from "./infrastructure/settings-repository.js";

/**
 * Settings service + repository only. The HTTP controller lives in `SettingsApiModule` because it
 * needs `AccessGuard` (which itself needs `SettingsService.today()`) — keeping the controller out of
 * this module avoids a circular module import.
 */
@Module({
  imports: [AuditModule],
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
