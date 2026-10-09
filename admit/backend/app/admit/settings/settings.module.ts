import { Module } from "@nestjs/common";
import { AuditModule, IdentityModule } from "@core/index.js";
import { AdmitMeController, SettingsController } from "./api/settings.controller.js";
import { SettingsService } from "./application/settings-service.js";

/** The organizer's public identity: name, support address, logo, time zone. */
@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [SettingsController, AdmitMeController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
