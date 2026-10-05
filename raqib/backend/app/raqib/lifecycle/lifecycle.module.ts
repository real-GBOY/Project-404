import { Module } from "@nestjs/common";
import { AuditModule, FilesModule } from "@core/index.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { LifecycleService } from "./lifecycle-service.js";

@Module({
  imports: [AuditModule, FilesModule, SettingsModule],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
