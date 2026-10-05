import { Module } from "@nestjs/common";
import { RbacModule } from "@core/index.js";
import { FormsModule } from "@raqib/raqib/forms/forms.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { SettingsRepository } from "@raqib/raqib/settings/infrastructure/settings-repository.js";
import { ProvisioningService } from "./provisioning-service.js";

@Module({
  imports: [RbacModule, PeopleModule, FormsModule, SettingsModule],
  providers: [ProvisioningService, SettingsRepository],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
