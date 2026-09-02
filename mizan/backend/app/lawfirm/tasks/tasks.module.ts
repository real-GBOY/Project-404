import { Module } from "@nestjs/common";
import { EventsModule, IdentityModule } from "../../../../../core/index.js";
import { LawfirmSharedModule } from "../shared/shared.module.js";
import { TasksController } from "./tasks.controller.js";
import { TasksRepository } from "./tasks-repository.js";
import { TasksService } from "./tasks-service.js";

@Module({
  imports: [LawfirmSharedModule, IdentityModule, EventsModule],
  controllers: [TasksController],
  providers: [TasksRepository, TasksService],
  exports: [TasksRepository],
})
export class TasksModule {}
