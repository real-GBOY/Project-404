import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { ProjectsController } from "./api/projects.controller.js";
import { ProjectsService } from "./application/projects-service.js";
import { ProjectsRepository } from "./infrastructure/projects-repository.js";

@Module({
  imports: [AuditModule, AccessModule, PeopleModule],
  controllers: [ProjectsController],
  providers: [ProjectsRepository, ProjectsService],
  exports: [ProjectsRepository, ProjectsService],
})
export class ProjectsModule {}
