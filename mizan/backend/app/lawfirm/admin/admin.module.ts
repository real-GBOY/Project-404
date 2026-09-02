import { Module } from "@nestjs/common";
import { AuditModule, RbacModule } from "@core/index.js";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminRepository } from "./admin-repository.js";
import { AdminService } from "./admin-service.js";

@Module({
  imports: [RbacModule, AuditModule, LawfirmSharedModule],
  controllers: [AdminController],
  providers: [AdminRepository, AdminService],
  exports: [AdminService],
})
export class AdminModule {}
