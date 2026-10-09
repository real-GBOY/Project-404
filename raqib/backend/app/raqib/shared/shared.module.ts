import { Module } from "@nestjs/common";
import { FilesModule } from "@core/index.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { BrandingService } from "./branding.js";
import { Counters } from "./counters.js";
import { UploadGuard } from "./upload-guard.js";

/** Cross-feature infrastructure every Raqib module may use (reference counters, the upload gate). */
@Module({ imports: [FilesModule, SettingsModule], providers: [Counters, UploadGuard, BrandingService], exports: [Counters, UploadGuard, BrandingService] })
export class SharedModule {}
