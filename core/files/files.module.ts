import { Module } from "@nestjs/common";
import type { AuricConfig } from "../kernel/config.js";
import { CONFIG, FILE_STORAGE, STORAGE_ADAPTER } from "../kernel/tokens.js";
import { RbacModule } from "../rbac/rbac.module.js";
import { FileRepository } from "./infrastructure/file-repository.js";
import { LocalDiskAdapter } from "./infrastructure/storage-adapter.js";
import { FileStorageService } from "./infrastructure/file-storage.js";
import { FilesController } from "./api/files.controller.js";

/**
 * File storage (§7.6). `FILE_STORAGE` is the `IFileStorage` domain modules
 * (e.g. Employee documents) depend on; the local-disk adapter is swappable for
 * S3 with no use-case change. Files are RLS-scoped and namespaced by tenant in
 * the storage key (§ docs/tenancy.md).
 */
@Module({
  imports: [RbacModule],
  controllers: [FilesController],
  providers: [
    FileRepository,
    FileStorageService,
    { provide: FILE_STORAGE, useExisting: FileStorageService },
    {
      provide: STORAGE_ADAPTER,
      inject: [CONFIG],
      useFactory: (config: AuricConfig) => new LocalDiskAdapter(config.fileStoragePath),
    },
  ],
  exports: [FILE_STORAGE],
})
export class FilesModule {}
