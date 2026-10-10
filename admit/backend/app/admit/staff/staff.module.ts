import { Module } from "@nestjs/common";
import { AuditModule, IdentityModule, OrganizationsModule, RbacModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { StaffController } from "./api/staff.controller.js";
import { AccountController } from "./api/account.controller.js";
import { TeamController } from "./api/team.controller.js";
import { TeamService } from "./application/team-service.js";
import { StaffService } from "./application/staff-service.js";
import { ProvisioningService } from "./application/provisioning-service.js";

/** Which people work which events (the per-event reach that sits on top of Core RBAC). */
@Module({
  imports: [AuditModule, IdentityModule, OrganizationsModule, RbacModule, AdmitEventsModule],
  controllers: [StaffController, TeamController, AccountController],
  providers: [StaffService, TeamService, ProvisioningService],
  exports: [StaffService, ProvisioningService],
})
export class StaffModule {}
