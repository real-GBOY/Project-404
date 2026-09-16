import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { TasksController } from "./api/tasks.controller.js";
import { TasksRepository } from "./infrastructure/tasks-repository.js";
import { TasksService } from "./application/tasks-service.js";
import { WorkflowsController } from "./api/workflows.controller.js";
import { WorkflowsRepository } from "./infrastructure/workflows-repository.js";
import { WorkflowsService } from "./application/workflows-service.js";
import { ApprovalsController } from "./api/approvals.controller.js";
import { ApprovalsRepository } from "./infrastructure/approvals-repository.js";
import { ApprovalsService } from "./application/approvals-service.js";
import { DocumentsController } from "./api/documents.controller.js";
import { DocumentsRepository } from "./infrastructure/documents-repository.js";
import { DocumentsService } from "./application/documents-service.js";

@Module({
  imports: [AuditModule],
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
  exports: [
    TasksRepository,
    TasksService,
    WorkflowsRepository,
    WorkflowsService,
    ApprovalsRepository,
    ApprovalsService,
    DocumentsRepository,
    DocumentsService,
  ],
})
export class OperationsModule {}
