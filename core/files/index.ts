import type { Router } from "express";
import type { UnitOfWork } from "../kernel/db/db.js";
import type { Clock } from "../kernel/clock.js";
import type { AuricConfig } from "../kernel/config.js";
import type { IFileStorage, IPermissionProvider } from "../contracts/index.js";
import type { RouteContext } from "../http/route-context.js";
import type { PermissionDefinition } from "../rbac/domain/permission.js";
import { FileRepository } from "./infrastructure/file-repository.js";
import { LocalDiskAdapter, type StorageAdapter } from "./infrastructure/storage-adapter.js";
import { FileStorageService } from "./infrastructure/file-storage.js";
import { fileRoutes } from "./api/routes.js";
import { filePermissions } from "./permissions/permissions.js";

export interface FilesModuleDeps {
  config: AuricConfig;
  clock: Clock;
  uow: UnitOfWork;
  permissions: IPermissionProvider;
  /** Override the storage backend (e.g. an S3 adapter). */
  adapter?: StorageAdapter;
}

export interface FilesModule {
  storage: IFileStorage & { getMetadata(id: string): Promise<unknown> };
  permissions: PermissionDefinition[];
  routes(ctx: RouteContext): Router;
}

export function createFilesModule(deps: FilesModuleDeps): FilesModule {
  const repo = new FileRepository();
  const adapter = deps.adapter ?? new LocalDiskAdapter(deps.config.fileStoragePath);
  const storage = new FileStorageService(repo, adapter, deps.uow, deps.clock);

  return {
    storage,
    permissions: filePermissions,
    routes: (ctx) => fileRoutes(storage, deps.permissions, ctx),
  };
}
