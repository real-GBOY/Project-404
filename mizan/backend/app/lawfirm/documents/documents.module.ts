import { Module } from "@nestjs/common";
import { FilesModule, IdentityModule } from "../../../../../core/index.js";
import { LawfirmSharedModule } from "../shared/shared.module.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsRepository } from "./documents-repository.js";
import { DocumentsService } from "./documents-service.js";

@Module({
  imports: [LawfirmSharedModule, FilesModule, IdentityModule],
  controllers: [DocumentsController],
  providers: [DocumentsRepository, DocumentsService],
  exports: [DocumentsRepository],
})
export class DocumentsModule {}
