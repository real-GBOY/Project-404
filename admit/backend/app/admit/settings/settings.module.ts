import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { SettingsController } from "./api/settings.controller.js";
import { SettingsService } from "./application/settings-service.js";

/** The organizer's public identity: name, support address, logo, time zone. */
@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
