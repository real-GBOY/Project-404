import { Module } from "@nestjs/common";
import { AuditModule, EventsModule, IdentityModule } from "@core/index.js";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { SettingsModule } from "@app/lawfirm/settings/settings.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingRepository } from "./billing-repository.js";
import { BillingService } from "./billing-service.js";

@Module({
  imports: [LawfirmSharedModule, SettingsModule, IdentityModule, AuditModule, EventsModule],
  controllers: [BillingController],
  providers: [BillingRepository, BillingService],
  exports: [BillingRepository],
})
export class BillingModule {}
