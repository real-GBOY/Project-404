import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { FormsController } from "./api/forms.controller.js";
import { FormsService } from "./application/forms-service.js";
import { FormsRepository } from "./infrastructure/forms-repository.js";

@Module({
  imports: [AuditModule, AccessModule, PeopleModule, SettingsModule],
  controllers: [FormsController],
  providers: [FormsRepository, FormsService],
  exports: [FormsRepository, FormsService],
})
export class FormsModule {}
