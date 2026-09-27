import { Module } from "@nestjs/common";
import { AuditModule, IdentityModule, OrganizationsModule, RbacModule } from "@core/index.js";
import { StaffController } from "./api/staff.controller.js";
import { StaffService } from "./application/staff-service.js";
import { StaffRepository } from "./infrastructure/staff-repository.js";

@Module({
  imports: [AuditModule, IdentityModule, OrganizationsModule, RbacModule],
  controllers: [StaffController],
  providers: [StaffRepository, StaffService],
  exports: [StaffService],
})
export class StaffModule {}
