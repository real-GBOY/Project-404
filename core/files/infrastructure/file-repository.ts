import { currentExecutor } from "../../kernel/db/db.js";

export interface FileRow {
  id: string;
  storageKey: string;
  driver: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  ownerId: string | null;
  visibility: "private" | "public";
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export class FileRepository {
  async insert(input: Omit<FileRow, "createdAt" | "deletedAt">): Promise<void> {
    await currentExecutor()
      .insertInto("files")
      .values({
        id: input.id,
        storage_key: input.storageKey,
        driver: input.driver,
        original_name: input.originalName,
        content_type: input.contentType,
        byte_size: input.byteSize,
        checksum_sha256: input.checksumSha256,
        owner_id: input.ownerId,
        visibility: input.visibility,
        metadata: input.metadata ?? null,
      })
      .execute();
  }

  async findById(id: string, includeDeleted = false): Promise<FileRow | null> {
    let q = currentExecutor().selectFrom("files").selectAll().where("id", "=", id);
    if (!includeDeleted) q = q.where("deleted_at", "is", null);
    const row = await q.executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async findByStorageKey(key: string): Promise<FileRow | null> {
    const row = await currentExecutor()
      .selectFrom("files")
      .selectAll()
      .where("storage_key", "=", key)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async softDelete(id: string, at: Date): Promise<void> {
    await currentExecutor()
      .updateTable("files")
      .set({ deleted_at: at })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .execute();
  }

  private toRow(r: {
    id: string;
    storage_key: string;
    driver: string;
    original_name: string;
    content_type: string;
    byte_size: number;
    checksum_sha256: string;
    owner_id: string | null;
    visibility: string;
    metadata: unknown;
    created_at: Date;
    deleted_at: Date | null;
  }): FileRow {
    return {
      id: r.id,
      storageKey: r.storage_key,
      driver: r.driver,
      originalName: r.original_name,
      contentType: r.content_type,
      byteSize: Number(r.byte_size),
      checksumSha256: r.checksum_sha256,
      ownerId: r.owner_id,
      visibility: r.visibility as "private" | "public",
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      createdAt: new Date(r.created_at),
      deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    };
  }
}
