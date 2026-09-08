import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AppError, NotFound, ValidationError } from "@core/kernel/errors.js";
import { CLOCK, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IFileStorage } from "@core/contracts/index.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import {
  DocumentsRepository,
  type DocumentRow,
  type DocumentStatus,
} from "./documents-repository.js";

const DAY = 86_400_000;

const log = moduleLogger("lawfirm-documents");

export interface UploadInput {
  name: string;
  matterId: string | null;
  category: string;
  file?: { content: Buffer; originalName: string; contentType: string };
}

export interface CreateUploadInput {
  name: string;
  matterId: string | null;
  category: string;
  contentType: string;
  byteSize: number;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repo: DocumentsRepository,
    private readonly directory: LawfirmDirectory,
    private readonly activity: ActivityService,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async summary() {
    return readInTenant(async () => {
      const all = await this.repo.all();
      const monthStart = new Date(this.clock.now());
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return {
        total: all.length,
        awaitingReview: all.filter((d) => d.status === "draft").length,
        expiring: all.filter((d) => /power|authority|attorney/i.test(`${d.category} ${d.name}`))
          .length,
        addedThisMonth: all.filter((d) => d.uploadedAt >= monthStart).length,
      };
    });
  }

  async list(filter: {
    matterId?: string;
    q?: string;
    category?: string;
    status?: DocumentStatus | "all";
  }) {
    return readInTenant(async () => {
      const rows = await this.repo.list({
        matterId: filter.matterId,
        q: filter.q,
        category: filter.category && filter.category !== "all" ? filter.category : undefined,
        status: filter.status && filter.status !== "all" ? filter.status : undefined,
      });
      const items = await Promise.all(rows.map((d) => this.view(d)));
      return { items, total: items.length };
    });
  }

  async get(id: string) {
    const doc = await readInTenant(() => this.repo.findById(id));
    if (!doc) throw NotFound("document.not_found", "Document not found.");
    return readInTenant(() => this.view(doc));
  }

  /** The stored bytes for a document, for the download route. */
  async content(id: string): Promise<{ content: Buffer; filename: string; contentType: string }> {
    const doc = await readInTenant(() => this.repo.findById(id));
    if (!doc) throw NotFound("document.not_found", "Document not found.");
    if (!doc.fileId || doc.fileId.endsWith("-placeholder")) {
      throw ValidationError("document.no_file", "This document has no file attached.");
    }
    try {
      const { content, ref } = await this.files.getContent({ id: doc.fileId });
      return { content, filename: doc.name || ref.originalName, contentType: ref.contentType };
    } catch (err) {
      // The underlying file is still awaiting its direct upload / confirm.
      if (err instanceof AppError && err.code === "files.upload_pending") {
        throw ValidationError(
          "document.upload_pending",
          "This document's file upload has not been confirmed yet.",
        );
      }
      throw err;
    }
  }

  /**
   * Begin a presigned upload for a new document: reserves the document row and
   * a `pending` file, and hands back where the client should PUT the bytes.
   * The document is not downloadable until `confirmUpload` runs.
   */
  async createUpload(input: CreateUploadInput, actorId: string) {
    const { fileId, upload } = await this.files.createUpload({
      originalName: input.name,
      contentType: input.contentType,
      byteSize: input.byteSize,
      ownerId: actorId,
      visibility: "private",
    });

    const doc = await this.uow.transaction(() =>
      this.repo.create({
        name: input.name,
        matterId: input.matterId,
        category: input.category,
        fileId,
        sizeBytes: input.byteSize,
        mimeType: input.contentType,
        uploadedById: actorId,
      }),
    );
    const document = await readInTenant(() => this.view(doc));
    return { document, upload };
  }

  /**
   * Finalize a document's presigned upload: confirms the underlying file
   * (HEAD against storage), reconciles size/mime if the object differs from
   * what the client declared, and records the `document.uploaded` activity —
   * on confirm, not on presign.
   */
  async confirmUpload(docId: string, actorId: string) {
    const doc = await readInTenant(() => this.repo.findById(docId));
    if (!doc) throw NotFound("document.not_found", "Document not found.");

    const ref = await this.files.confirmUpload(doc.fileId);

    const updated = await this.uow.transaction(async () => {
      if (ref.byteSize !== doc.sizeBytes || ref.contentType !== doc.mimeType) {
        await this.repo.setFileMeta(docId, {
          sizeBytes: ref.byteSize,
          mimeType: ref.contentType,
        });
      }
      if (doc.matterId) {
        await this.activity.record({
          actorId,
          action: "document.uploaded",
          targetType: "document",
          targetId: doc.id,
          targetLabel: doc.name,
        });
      }
      return (await this.repo.findById(docId))!;
    });
    return readInTenant(() => this.view(updated));
  }

  async upload(input: UploadInput, actorId: string) {
    let fileId = lawfirmId("cdoc") + "-placeholder";
    let sizeBytes = 0;
    let mimeType = input.name.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    if (input.file) {
      const ref = await this.files.upload({
        content: input.file.content,
        originalName: input.file.originalName,
        contentType: input.file.contentType || "application/octet-stream",
        ownerId: actorId,
        visibility: "private",
      });
      fileId = ref.id;
      sizeBytes = ref.byteSize;
      mimeType = ref.contentType;
    }

    const doc = await this.uow.transaction(async () => {
      const created = await this.repo.create({
        name: input.name,
        matterId: input.matterId,
        category: input.category,
        fileId,
        sizeBytes,
        mimeType,
        uploadedById: actorId,
      });
      if (input.matterId) {
        await this.activity.record({
          actorId,
          action: "document.uploaded",
          targetType: "document",
          targetId: created.id,
          targetLabel: created.name,
        });
      }
      return created;
    });
    return readInTenant(() => this.view(doc));
  }

  async update(id: string, patch: { name?: string; category?: string; status?: DocumentStatus }) {
    const doc = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("document.not_found", "Document not found.");
      return (await this.repo.update(id, patch))!;
    });
    return readInTenant(() => this.view(doc));
  }

  async remove(id: string) {
    const fileId = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("document.not_found", "Document not found.");
      await this.repo.remove(id);
      return existing.fileId;
    });

    // Drop the underlying stored object too — otherwise deleting a document
    // orphans its bytes in R2 / on disk forever. A metadata-only document has a
    // `-placeholder` fileId and nothing to remove. Best-effort: the document is
    // already gone, so a storage hiccup shouldn't fail the request.
    if (fileId && !fileId.endsWith("-placeholder")) {
      await this.files.delete({ id: fileId }).catch((err: unknown) => {
        log.warn(
          { err, fileId, documentId: id },
          "document removed but its file could not be deleted",
        );
      });
    }
  }

  private async view(d: DocumentRow) {
    const matter = d.matterId ? await this.repo.matterContext(d.matterId) : null;
    return {
      id: d.id,
      name: d.name,
      matterId: d.matterId,
      matterTitle: matter?.title ?? null,
      matterReference: matter?.reference ?? null,
      category: d.category,
      status: d.status,
      sizeBytes: d.sizeBytes,
      mimeType: d.mimeType,
      uploadedBy: await this.directory.userName(d.uploadedById),
      uploadedAt: d.uploadedAt.toISOString(),
    };
  }

  /** Test/dashboard helper. */
  readonly EXPIRING_DAYS = 30 * DAY;
}
