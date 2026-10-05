import { Inject, Injectable } from "@nestjs/common";
import { Internal, ValidationError } from "@core/kernel/errors.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { FILE_STORAGE } from "@core/kernel/tokens.js";
import type { FileRef, IFileStorage } from "@core/contracts/index.js";
import { readRaqibConfig } from "@raqib/config.js";
import { clamdScan } from "./clamav.js";
import { pdfActiveContent, sniff, type SniffedKind } from "./content-sniff.js";
import { stripImageMetadata } from "./image-sanitize.js";

const log = moduleLogger("raqib-upload-guard");

/** Files up to this size are read into memory to be checked; larger ones (video) are checked by size and type only. */
export const INSPECT_LIMIT_BYTES = 64 * 1_048_576;

export interface Admitted {
  file: FileRef;
  /** Run after the surrounding transaction commits: removes the original when a cleaned copy replaced it. */
  afterCommit: () => Promise<void>;
}

/**
 * The last gate before an uploaded file becomes evidence. It reads the bytes (photos and PDFs) and refuses a file whose
 * content is not what was declared, a PDF that carries scripts or launch actions, and anything the antivirus daemon
 * flags (when `RAQIB_CLAMAV_HOST` is set — if it is set and unreachable the upload is refused rather than waved through).
 * Photos are re-stored without their location and device metadata. Videos are not read into memory.
 */
@Injectable()
export class UploadGuard {
  constructor(@Inject(FILE_STORAGE) private readonly files: IFileStorage) {}

  async admit(file: FileRef & { ownerId: string | null }, declared: SniffedKind, ownerId: string): Promise<Admitted> {
    const none: Admitted = { file, afterCommit: async () => undefined };
    if (declared === "video" || file.byteSize > INSPECT_LIMIT_BYTES) return none;

    const { content } = await this.files.getContent({ id: file.id });
    const real = sniff(content);
    if (!real || real.kind !== declared) {
      log.warn({ fileId: file.id, declared, found: real?.format ?? "unknown" }, "upload refused: content does not match its type");
      throw ValidationError("raqib.file_content_mismatch", "The file's content does not match its type. Upload a real photo, video or PDF.");
    }
    if (real.format === "pdf") {
      const marker = pdfActiveContent(content);
      if (marker) {
        log.warn({ fileId: file.id, marker }, "upload refused: pdf with active content");
        throw ValidationError(
          "raqib.pdf_active_content",
          "This PDF contains scripts or embedded content and cannot be attached. Export it again as a plain PDF.",
        );
      }
    }

    const cfg = readRaqibConfig();
    if (cfg.clamavHost) {
      let verdict: Awaited<ReturnType<typeof clamdScan>>;
      try {
        verdict = await clamdScan(content, cfg.clamavHost, cfg.clamavPort);
      } catch (err) {
        log.error({ err, fileId: file.id }, "antivirus scan unavailable — upload refused");
        throw Internal("The file could not be scanned. Try again shortly.", err);
      }
      if (!verdict.clean) {
        log.warn({ fileId: file.id, signature: verdict.signature }, "upload refused: malware signature");
        throw ValidationError("raqib.file_infected", "The file was rejected by the virus scan.");
      }
    }

    if (real.kind === "photo") {
      const clean = stripImageMetadata(content, real.format);
      if (clean !== content && !clean.equals(content)) {
        const stored = await this.files.upload({
          content: clean,
          originalName: file.originalName,
          contentType: file.contentType,
          ownerId: file.ownerId ?? ownerId,
          visibility: "private",
        });
        return {
          file: stored,
          afterCommit: () => this.files.delete({ id: file.id }).catch((err) => log.error({ err, fileId: file.id }, "could not remove the original upload")),
        };
      }
    }
    return none;
  }
}
