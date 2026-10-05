import { Module } from "@nestjs/common";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { SettingsController } from "./api/settings.controller.js";
import { SettingsModule } from "./settings.module.js";

@Module({
  imports: [SettingsModule, AccessModule],
  controllers: [SettingsController],
})
export class SettingsApiModule {}
