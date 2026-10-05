import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { AuditController } from "./api/audit.controller.js";
import { AuditService } from "./application/audit-service.js";

/** Raqib's read view of the audit trail (the writing side is Core's AuditModule). */
@Module({
  imports: [AuditModule, AccessModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditViewModule {}
