import { Module } from "@nestjs/common";
import { RbacModule, AuditModule, IdentityModule, OrganizationsModule } from "@core/index.js";
import { RealestateSharedModule } from "@atlas/realestate/shared/shared.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminRepository } from "./admin-repository.js";
import { AdminService } from "./admin-service.js";
import { OrgSettingsRepository } from "./org-settings-repository.js";
import { OrgSettingsService } from "./org-settings-service.js";
import { TeamController } from "./team.controller.js";
import { TeamService } from "./team-service.js";

@Module({
  imports: [RbacModule, AuditModule, IdentityModule, OrganizationsModule, RealestateSharedModule, CrmModule],
  controllers: [AdminController, TeamController],
  providers: [AdminRepository, AdminService, OrgSettingsRepository, OrgSettingsService, TeamService],
  exports: [AdminService],
})
export class AdminModule {}
