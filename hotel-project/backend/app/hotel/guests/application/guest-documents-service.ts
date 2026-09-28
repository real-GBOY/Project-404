import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AppError, Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger, IFileStorage } from "@core/contracts/index.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import { GuestsRepository } from "../infrastructure/guests-repository.js";
import {
  GuestDocumentsRepository,
  type DocumentKind,
} from "../infrastructure/guest-documents-repository.js";

const log = moduleLogger("guest-documents");

/**
 * A guest's paperwork (ID scans, signed forms). The bytes are uploaded to Core's files module by
 * the client (presign → PUT → confirm); this service only links a STORED file to the guest, and
 * only a file the same staff member uploaded — so nobody can attach someone else's file by id.
 * Downloads go through Core (`GET /api/files/:id`, `read:file`).
 */
@Injectable()
export class GuestDocumentsService {
  constructor(
    private readonly repo: GuestDocumentsRepository,
    private readonly guests: GuestsRepository,
    private readonly directory: UserDirectory,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(guestId: string) {
    return readInTenant(async () => {
      await this.requireGuest(guestId);
      const docs = await this.repo.list(guestId);
      const names = await this.directory.userNames(docs.map((d) => d.uploadedBy));
      return Promise.all(
        docs.map(async (d) => {
          const file = await this.files.describe(d.fileId).catch(() => null);
          return {
            id: d.id,
            fileId: d.fileId,
            kind: d.kind,
            label: d.label,
            fileName: file?.originalName ?? null,
            contentType: file?.contentType ?? null,
            byteSize: file?.byteSize ?? null,
            uploadedByName: d.uploadedBy ? (names.get(d.uploadedBy) ?? null) : null,
            createdAt: d.createdAt,
          };
        }),
      );
    });
  }

  async attach(
    guestId: string,
    input: { fileId: string; kind: DocumentKind; label: string | null },
    actorId: string,
  ) {
    try {
      return await this.uow.transaction(async () => {
        await this.requireGuest(guestId);
        const file = await this.files.describe(input.fileId).catch((err: unknown) => {
          if (err instanceof AppError) return null;
          throw err;
        });
        if (!file) throw ValidationError("document.unknown_file", "That upload wasn't found.");
        if (file.status !== "stored") {
          throw ValidationError("document.not_uploaded", "The upload hasn't finished yet.");
        }
        if (file.ownerId !== actorId) {
          throw Forbidden("document.not_yours", "You can only attach files you uploaded.");
        }
        const id = await this.repo.insert({ guestId, ...input, uploadedBy: actorId });
        await this.audit.record({
          actorId,
          action: "hotel.guest.document_added",
          resourceType: "hotel_guest",
          resourceId: guestId,
          after: { documentId: id, kind: input.kind, fileName: file.originalName },
        });
        return { id };
      });
    } catch (err) {
      if (isUniqueViolation(err, "hotel_guest_documents_file_uq")) {
        throw Conflict("document.already_attached", "That file is already attached.");
      }
      throw err;
    }
  }

  async remove(guestId: string, documentId: string, actorId: string) {
    const doc = await this.uow.transaction(async () => {
      const d = await this.repo.find(guestId, documentId);
      if (!d) throw NotFound("document.not_found", "Document not found.");
      await this.repo.delete(d.id);
      await this.audit.record({
        actorId,
        action: "hotel.guest.document_removed",
        resourceType: "hotel_guest",
        resourceId: guestId,
        before: { documentId: d.id, kind: d.kind },
      });
      return d;
    });
    // The link is gone (committed); the stored bytes go too — best effort, never blocking.
    await readInTenant(() => this.files.delete({ id: doc.fileId })).catch((err: unknown) =>
      log.warn({ err, fileId: doc.fileId }, "document file not deleted"),
    );
    return { ok: true };
  }

  private async requireGuest(id: string) {
    if (!(await this.guests.findById(id))) {
      throw NotFound("guest.not_found", "Guest not found.");
    }
  }
}
