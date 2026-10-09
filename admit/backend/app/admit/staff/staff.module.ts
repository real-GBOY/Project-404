import { Module } from "@nestjs/common";
import { AuditModule, IdentityModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { StaffController } from "./api/staff.controller.js";
import { StaffService } from "./application/staff-service.js";

/** Which people work which events (the per-event reach that sits on top of Core RBAC). */
@Module({
  imports: [AuditModule, IdentityModule, AdmitEventsModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
