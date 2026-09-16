import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { DocumentsRepository, type CreateDocumentInput } from "../infrastructure/documents-repository.js";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repo: DocumentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(relatedType?: string, relatedId?: string) {
    return readInTenant(() => this.repo.list(relatedType, relatedId));
  }

  create(input: CreateDocumentInput) {
    return this.uow.transaction(() => this.repo.create(input));
  }
}
