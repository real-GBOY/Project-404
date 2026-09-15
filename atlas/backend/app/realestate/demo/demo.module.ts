import { Module } from "@nestjs/common";
import { IdentityModule, OrganizationsModule, RbacModule } from "@core/index.js";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { SalesModule } from "@atlas/realestate/sales/sales.module.js";
import { OperationsModule } from "@atlas/realestate/operations/operations.module.js";
import { AssistantModule } from "@atlas/realestate/assistant/assistant.module.js";
import { DemoSeeder } from "./demo-seeder.js";

@Module({
  imports: [
    IdentityModule,
    OrganizationsModule,
    RbacModule,
    PropertiesModule,
    CrmModule,
    SalesModule,
    OperationsModule,
    AssistantModule,
  ],
  providers: [DemoSeeder],
  exports: [DemoSeeder],
})
export class DemoModule {}
