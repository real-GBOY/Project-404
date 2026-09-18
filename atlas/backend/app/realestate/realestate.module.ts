import { Module } from "@nestjs/common";
import { RealestateSharedModule } from "@atlas/realestate/shared/shared.module.js";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { SalesModule } from "@atlas/realestate/sales/sales.module.js";
import { FinanceModule } from "@atlas/realestate/finance/finance.module.js";
import { OperationsModule } from "@atlas/realestate/operations/operations.module.js";
import { AssistantModule } from "@atlas/realestate/assistant/assistant.module.js";
import { AdminModule } from "@atlas/realestate/admin/admin.module.js";
import { DashboardModule } from "@atlas/realestate/dashboard/dashboard.module.js";
import { LeadIntelligenceModule } from "@atlas/realestate/lead-intelligence/lead-intelligence.module.js";
import { ConversationIntelligenceModule } from "@atlas/realestate/conversation-intelligence/conversation-intelligence.module.js";

/**
 * The Atlas real-estate product domain (mirrors
 * `mizan/backend/app/lawfirm/lawfirm.module.ts`). Composes every feature
 * area over the shared directory. Each area reaches Core only through the
 * provider contracts in `core/contracts`, the sanctioned exception being the
 * `admin` adapter + `app/seed.ts` reaching into `core/rbac`.
 */
@Module({
  imports: [
    RealestateSharedModule,
    PropertiesModule,
    CrmModule,
    SalesModule,
    FinanceModule,
    OperationsModule,
    AssistantModule,
    AdminModule,
    DashboardModule,
    LeadIntelligenceModule,
    ConversationIntelligenceModule,
  ],
})
export class RealestateModule {}
