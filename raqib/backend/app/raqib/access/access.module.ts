import { Module } from "@nestjs/common";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { AccessGuard } from "./access.guard.js";
import { AccessService } from "./application/access-service.js";
import { AccessRepository } from "./infrastructure/access-repository.js";

@Module({
  imports: [SettingsModule],
  providers: [AccessRepository, AccessService, AccessGuard],
  exports: [AccessService, AccessGuard, AccessRepository],
})
export class AccessModule {}
