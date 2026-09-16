import { Module } from "@nestjs/common";
import { RbacModule, AuditModule, IdentityModule, OrganizationsModule } from "@core/index.js";
import { RealestateSharedModule } from "@atlas/realestate/shared/shared.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { AdminController } from "./api/admin.controller.js";
import { AdminRepository } from "./infrastructure/admin-repository.js";
import { AdminService } from "./application/admin-service.js";
import { OrgSettingsRepository } from "./infrastructure/org-settings-repository.js";
import { OrgSettingsService } from "./application/org-settings-service.js";
import { TeamController } from "./api/team.controller.js";
import { TeamService } from "./application/team-service.js";

@Module({
  imports: [RbacModule, AuditModule, IdentityModule, OrganizationsModule, RealestateSharedModule, CrmModule],
  controllers: [AdminController, TeamController],
  providers: [AdminRepository, AdminService, OrgSettingsRepository, OrgSettingsService, TeamService],
  exports: [AdminService],
})
export class AdminModule {}
