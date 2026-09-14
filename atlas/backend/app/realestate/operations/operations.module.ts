import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller.js";
import { TasksRepository } from "./tasks-repository.js";
import { TasksService } from "./tasks-service.js";
import { WorkflowsController } from "./workflows.controller.js";
import { WorkflowsRepository } from "./workflows-repository.js";
import { WorkflowsService } from "./workflows-service.js";
import { ApprovalsController } from "./approvals.controller.js";
import { ApprovalsRepository } from "./approvals-repository.js";
import { ApprovalsService } from "./approvals-service.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsRepository } from "./documents-repository.js";
import { DocumentsService } from "./documents-service.js";

@Module({
  controllers: [TasksController, WorkflowsController, ApprovalsController, DocumentsController],
  providers: [
    TasksRepository,
    TasksService,
    WorkflowsRepository,
    WorkflowsService,
    ApprovalsRepository,
    ApprovalsService,
    DocumentsRepository,
    DocumentsService,
  ],
  exports: [TasksRepository, ApprovalsRepository, DocumentsRepository],
})
export class OperationsModule {}
