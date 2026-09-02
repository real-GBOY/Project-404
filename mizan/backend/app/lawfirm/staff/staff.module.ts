import { Module } from "@nestjs/common";
import { IdentityModule } from "../../../../../core/index.js";
import { LawfirmSharedModule } from "../shared/shared.module.js";
import { AdminModule } from "../admin/admin.module.js";
import { TeamController } from "./team.controller.js";
import { StaffRepository } from "./staff-repository.js";
import { TeamService } from "./team-service.js";

@Module({
  imports: [LawfirmSharedModule, AdminModule, IdentityModule],
  controllers: [TeamController],
  providers: [StaffRepository, TeamService],
  exports: [StaffRepository],
})
export class StaffModule {}
