import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { PermissionsController } from "./api/permissions.controller.js";
import { PermissionsService } from "./application/permissions-service.js";

@Module({
  imports: [AuditModule, AccessModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
