import type { UnitOfWork } from "../../kernel/db/db.js";
import type { Clock } from "../../kernel/clock.js";
import { newId } from "../../kernel/id.js";
import { NotFound } from "../../kernel/errors.js";
import type { FileInput, FileRef, IFileStorage } from "../../contracts/index.js";
import { FileRepository, type FileRow } from "./file-repository.js";
import { sha256, storageKeyFor, type StorageAdapter } from "./storage-adapter.js";

/**
 * IFileStorage implementation (§4). Other modules (e.g. Employee documents,
 * §5) depend on this interface and do their own authorization in their use
 * cases. The Files HTTP API layers RBAC on top for direct file endpoints.
 */
export class FileStorageService implements IFileStorage {
  constructor(
    private readonly repo: FileRepository,
    private readonly adapter: StorageAdapter,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async upload(file: FileInput): Promise<FileRef> {
    const id = newId("file");
    const key = storageKeyFor(id, this.clock.now());
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
    const row = await this.requireRow(fileRef.id);
    return this.adapter.url(row.storageKey);
  }

  async getContent(fileRef: Pick<FileRef, "id">): Promise<{ content: Buffer; ref: FileRef }> {
    const row = await this.requireRow(fileRef.id);
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
    const row = await this.repo.findById(id);
    if (!row) throw NotFound("files.not_found", "File not found.");
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
