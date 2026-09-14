import { Module } from "@nestjs/common";
import { IdentityModule, OrganizationsModule, RbacModule } from "@core/index.js";
import { DemoSeeder } from "./demo-seeder.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, RbacModule],
  providers: [DemoSeeder],
  exports: [DemoSeeder],
})
export class DemoModule {}
