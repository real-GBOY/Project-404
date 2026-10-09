import { Inject, Injectable } from "@nestjs/common";
import { FILE_STORAGE } from "@core/kernel/tokens.js";
import type { IFileStorage } from "@core/contracts/index.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import type { L10n } from "./l10n.js";

export interface Brand {
  name: L10n;
  /** The logo as a data URI for the printable pages, or null while the client has not supplied one. */
  logo: string | null;
  logoFileId: string | null;
}

/**
 * The organization's name and logo, which every printed document carries. Both are settings, so they can be changed (or
 * supplied later) without touching code; until a logo is supplied the documents show the name alone.
 */
@Injectable()
export class BrandingService {
  constructor(
    private readonly settings: SettingsService,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
  ) {}

  /** A logo file as a data URI (null when absent or unreadable: a document is never blocked by its logo). */
  async logoOf(fileId: string | null | undefined): Promise<string | null> {
    if (!fileId) return null;
    try {
      const d = await this.files.describe(fileId);
      if (d.status !== "stored" || !["image/png", "image/jpeg"].includes(d.contentType) || d.byteSize > 1_048_576) return null;
      const { content } = await this.files.getContent({ id: fileId });
      return `data:${d.contentType};base64,${content.toString("base64")}`;
    } catch {
      return null;
    }
  }

  async current(): Promise<Brand> {
    const s = await this.settings.current();
    const logoFileId = s.org.logo || null;
    return { name: { ar: s.org.nameAr, en: s.org.nameEn }, logo: await this.logoOf(logoFileId), logoFileId };
  }
}
