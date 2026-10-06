/**
 * What a file really is, from its first bytes — never from the name or the type the client declared. Evidence is
 * photos, videos and PDFs; anything whose content says otherwise is refused, so an executable or an HTML page cannot
 * be filed as "image/jpeg".
 */
export type SniffedKind = "photo" | "video" | "doc";
export interface Sniffed {
  kind: SniffedKind;
  /** A specific format name (informational). */
  format: "jpeg" | "png" | "gif" | "webp" | "heic" | "mp4" | "mov" | "webm" | "pdf";
}

const startsWith = (b: Buffer, bytes: number[], at = 0): boolean => b.length >= at + bytes.length && bytes.every((v, i) => b[at + i] === v);
const ascii = (b: Buffer, from: number, to: number): string => b.subarray(from, to).toString("latin1");

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "avif"]);

export function sniff(b: Buffer): Sniffed | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { kind: "photo", format: "jpeg" };
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "photo", format: "png" };
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return { kind: "photo", format: "gif" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { kind: "photo", format: "webp" };
  if (ascii(b, 0, 5) === "%PDF-") return { kind: "doc", format: "pdf" };
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "video", format: "webm" };
  if (ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    if (HEIC_BRANDS.has(brand)) return { kind: "photo", format: "heic" };
    if (brand === "qt  ") return { kind: "video", format: "mov" };
    return { kind: "video", format: "mp4" };
  }
  return null;
}

/** Markers that make a PDF do things on open. Best effort over the raw bytes (compressed object streams can hide them). */
const ACTIVE_PDF = [/\/JavaScript\b/, /\/JS\s*[(<]/, /\/Launch\b/, /\/OpenAction\b/, /\/AA\s*</, /\/EmbeddedFile\b/, /\/RichMedia\b/, /\/XFA\b/];
export function pdfActiveContent(b: Buffer): string | null {
  const text = b.toString("latin1");
  for (const re of ACTIVE_PDF) if (re.test(text)) return re.source;
  return null;
}
