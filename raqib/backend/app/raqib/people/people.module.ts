import { Module } from "@nestjs/common";
import { AuditModule, IdentityModule, RbacModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { PeopleController } from "./api/people.controller.js";
import { PeopleService } from "./application/people-service.js";
import { PeopleRepository } from "./infrastructure/people-repository.js";

@Module({
  imports: [AuditModule, IdentityModule, RbacModule, AccessModule],
  controllers: [PeopleController],
  providers: [PeopleRepository, PeopleService],
  exports: [PeopleRepository, PeopleService],
})
export class PeopleModule {}
