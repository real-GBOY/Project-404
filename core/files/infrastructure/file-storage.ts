import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import type { Clock } from "@core/kernel/clock.js";
import type { AuricConfig } from "@core/kernel/config.js";
import { newId } from "@core/kernel/id.js";
import { NotFound, ValidationError } from "@core/kernel/errors.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { CLOCK, CONFIG, STORAGE_ADAPTER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type {
  CreateUploadInput,
  FileInput,
  FileRef,
  IFileStorage,
  PresignedUpload,
} from "@core/contracts/index.js";
import { FileRepository, type FileRow } from "./file-repository.js";
import { sha256, storageKeyFor, type StorageAdapter } from "./storage-adapter.js";

/**
 * IFileStorage implementation (§4). Other modules (e.g. Employee documents,
 * §5) depend on this interface and do their own authorization in their use
 * cases. The Files HTTP API layers RBAC on top for direct file endpoints.
 */
@Injectable()
export class FileStorageService implements IFileStorage {
  constructor(
    private readonly repo: FileRepository,
    @Inject(STORAGE_ADAPTER) private readonly adapter: StorageAdapter,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: AuricConfig,
  ) {}

  /**
   * Begin a presigned upload. Validates MIME + size, records a `pending` file
   * row, and returns the direct-to-storage PUT target. The bytes never touch
   * this process — the client uploads to `upload.url`, then calls
   * `confirmUpload`.
   */
  async createUpload(
    input: CreateUploadInput,
  ): Promise<{ fileId: string; upload: PresignedUpload }> {
    this.assertAllowed(input.contentType, input.byteSize);
    if (!this.adapter.presignPut) {
      throw ValidationError(
        "files.presign_unsupported",
        `The '${this.adapter.driver}' storage driver does not support presigned uploads.`,
      );
    }

    const id = newId("file");
    const key = storageKeyFor(requireOrganizationId(), id, this.clock.now());

    await this.uow.transaction(() =>
      this.repo.insert({
        id,
        storageKey: key,
        driver: this.adapter.driver,
        originalName: input.originalName,
        contentType: input.contentType,
        byteSize: input.byteSize,
        checksumSha256: input.checksumSha256 ?? "",
        ownerId: input.ownerId ?? null,
        visibility: input.visibility ?? "private",
        metadata: input.metadata ?? null,
        status: "pending",
      }),
    );

    const upload = await this.adapter.presignPut(key, {
      contentType: input.contentType,
      contentLength: input.byteSize,
      expiresIn: this.config.filePresignTtlSeconds,
    });
    return { fileId: id, upload };
  }

  /**
   * Finalize a presigned upload. HEADs the object to confirm it actually
   * landed, records its real size/etag, and flips the row to `stored`.
   * Idempotent — an already-`stored` file just returns its ref.
   */
  async confirmUpload(fileId: string): Promise<FileRef> {
    const row = await this.requireRow(fileId);
    if (row.status === "stored") return this.toRef(row);

    if (!this.adapter.head) {
      throw ValidationError(
        "files.head_unsupported",
        `The '${this.adapter.driver}' storage driver cannot verify uploads.`,
      );
    }
    const head = await this.adapter.head(row.storageKey);
    if (!head) {
      throw ValidationError(
        "files.upload_missing",
        "No uploaded object was found for this file. Did the upload complete?",
      );
    }
    if (head.size > this.config.fileMaxUploadBytes) {
      throw ValidationError(
        "files.too_large",
        `The uploaded file exceeds the ${this.config.fileMaxUploadBytes}-byte limit.`,
      );
    }

    await this.uow.transaction(() =>
      this.repo.markStored(fileId, {
        byteSize: head.size,
        checksum: head.etag ?? undefined,
        at: this.clock.now(),
      }),
    );
    return this.toRef({ ...row, byteSize: head.size, status: "stored" });
  }

  /**
   * Accept the raw bytes of a `pending` upload. Only reachable via the local
   * driver's authenticated loopback route (`PUT /api/files/:id/bytes`); `r2`
   * clients PUT straight to the presigned S3 URL and never hit this.
   */
  async writeBytes(fileId: string, content: Buffer): Promise<void> {
    const row = await this.requireRow(fileId);
    if (row.status !== "pending") {
      throw ValidationError("files.not_pending", "This file is not awaiting an upload.");
    }
    if (content.byteLength > this.config.fileMaxUploadBytes) {
      throw ValidationError(
        "files.too_large",
        `The uploaded file exceeds the ${this.config.fileMaxUploadBytes}-byte limit.`,
      );
    }
    await this.adapter.put(row.storageKey, content);
  }

  private assertAllowed(contentType: string, byteSize: number): void {
    if (byteSize <= 0) {
      throw ValidationError("files.empty_file", "The upload byte size must be positive.");
    }
    if (byteSize > this.config.fileMaxUploadBytes) {
      throw ValidationError(
        "files.too_large",
        `The file exceeds the ${this.config.fileMaxUploadBytes}-byte upload limit.`,
      );
    }
    const allowed = this.config.fileAllowedMimeTypes;
    if (allowed.length > 0 && !allowed.includes(contentType)) {
      throw ValidationError(
        "files.mime_not_allowed",
        `Files of type '${contentType}' are not accepted.`,
      );
    }
  }

  async upload(file: FileInput): Promise<FileRef> {
    const id = newId("file");
    const key = storageKeyFor(requireOrganizationId(), id, this.clock.now());
    const checksum = sha256(file.content);

    // Write bytes first; if the DB insert fails the orphan is harmless and
    // reclaimable. The reverse (row with no bytes) is worse.
    await this.adapter.put(key, file.content);

    await this.uow.transaction(() =>
      this.repo.insert({
        id,
        storageKey: key,
        driver: this.adapter.driver,
        originalName: file.originalName,
        contentType: file.contentType,
        byteSize: file.content.byteLength,
        checksumSha256: checksum,
        ownerId: file.ownerId ?? null,
        visibility: file.visibility ?? "private",
        metadata: file.metadata ?? null,
      }),
    );

    return {
      id,
      storageKey: key,
      contentType: file.contentType,
      byteSize: file.content.byteLength,
      originalName: file.originalName,
    };
  }

  async getUrl(fileRef: Pick<FileRef, "id">): Promise<string> {
    const row = await this.requireStoredRow(fileRef.id);
    return this.adapter.url(row.storageKey);
  }

  async getContent(fileRef: Pick<FileRef, "id">): Promise<{ content: Buffer; ref: FileRef }> {
    const row = await this.requireStoredRow(fileRef.id);
    const content = await this.adapter.get(row.storageKey);
    return { content, ref: this.toRef(row) };
  }

  async delete(fileRef: Pick<FileRef, "id">): Promise<void> {
    const row = await this.requireRow(fileRef.id);
    await this.uow.transaction(() => this.repo.softDelete(row.id, this.clock.now()));
    await this.adapter.remove(row.storageKey);
  }

  async getMetadata(id: string): Promise<FileRow> {
    return this.requireRow(id);
  }

  private async requireRow(id: string): Promise<FileRow> {
    // Read inside a transaction so RLS on `files` is in force (§ docs/tenancy.md):
    // a file from another tenant simply does not exist here.
    const row = await readInTenant(() => this.repo.findById(id));
    if (!row) throw NotFound("files.not_found", "File not found.");
    return row;
  }

  /** Like `requireRow`, but a still-`pending` upload counts as "not there yet". */
  private async requireStoredRow(id: string): Promise<FileRow> {
    const row = await this.requireRow(id);
    if (row.status === "pending") {
      throw ValidationError(
        "files.upload_pending",
        "This file's upload has not been confirmed yet.",
      );
    }
    return row;
  }

  private toRef(row: FileRow): FileRef {
    return {
      id: row.id,
      storageKey: row.storageKey,
      contentType: row.contentType,
      byteSize: row.byteSize,
      originalName: row.originalName,
    };
  }
}
