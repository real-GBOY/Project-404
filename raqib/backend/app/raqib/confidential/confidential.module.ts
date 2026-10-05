import { Module } from "@nestjs/common";
import { FilesModule, IdentityModule, NotificationsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { ConfidentialController } from "./api/confidential.controller.js";
import { ConfidentialService } from "./application/confidential-service.js";
import { ConfRepository } from "./infrastructure/conf-repository.js";

/** The confidential reporting area — deliberately depends on nothing operational beyond identity of staff. */
@Module({
  imports: [FilesModule, IdentityModule, NotificationsModule, AccessModule, ProjectsModule, SettingsModule, SharedModule],
  controllers: [ConfidentialController],
  providers: [ConfRepository, ConfidentialService],
  exports: [ConfidentialService],
})
export class ConfidentialModule {}
