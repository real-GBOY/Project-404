import { Module } from "@nestjs/common";
import { FilesModule } from "@core/index.js";
import { Counters } from "./counters.js";
import { UploadGuard } from "./upload-guard.js";

/** Cross-feature infrastructure every Raqib module may use (reference counters, the upload gate). */
@Module({ imports: [FilesModule], providers: [Counters, UploadGuard], exports: [Counters, UploadGuard] })
export class SharedModule {}
