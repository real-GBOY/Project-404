/**
 * Strips location and device metadata from photos before they are stored as evidence. A guard's phone writes GPS
 * coordinates, a serial number and the exact time into every picture; none of that belongs in a report that may be read
 * by people who were never meant to learn where the guard stood.
 *
 *  - JPEG: every APP1/APP2/APP13/APP12/COM segment is dropped; a minimal EXIF segment carrying only the Orientation tag
 *    is written back, so photos do not turn sideways.
 *  - PNG: eXIf and text chunks (tEXt, zTXt, iTXt) are dropped.
 *  - Anything else (GIF, WebP, HEIC) is returned unchanged.
 */

const DROP_JPEG = new Set([0xe1, 0xe2, 0xec, 0xed, 0xee, 0xfe]); // APP1 (EXIF/XMP), APP2 (ICC/FPXR), APP12, APP13, APP14, COM

/** The EXIF Orientation (1–8) of a JPEG, or null. */
export function jpegOrientation(b: Buffer): number | null {
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const marker = b[p + 1]!;
    if (marker === 0xda || marker === 0xd9) return null;
    const len = b.readUInt16BE(p + 2);
    if (marker === 0xe1 && b.toString("latin1", p + 4, p + 10) === "Exif\0\0") {
      const t = p + 10; // TIFF header
      const le = b.toString("latin1", t, t + 2) === "II";
      const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
      const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
      if (t + 8 > b.length) return null;
      const ifd = t + u32(t + 4);
      if (ifd + 2 > b.length) return null;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > b.length) return null;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : null;
        }
      }
      return null;
    }
    p += 2 + len;
  }
  return null;
}

/** A tiny big-endian EXIF segment holding only Orientation. */
function orientationSegment(o: number): Buffer {
  const tiff = Buffer.from([
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    o,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

export function stripJpeg(b: Buffer): Buffer {
  if (!(b[0] === 0xff && b[1] === 0xd8)) return b;
  const orientation = jpegOrientation(b);
  const out: Buffer[] = [b.subarray(0, 2)];
  if (orientation && orientation !== 1) out.push(orientationSegment(orientation));
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const marker = b[p + 1]!;
    if (marker === 0xff) {
      p += 1;
      continue;
    }
    if (marker === 0xda) {
      out.push(b.subarray(p)); // start of scan: the rest is entropy-coded image data
      return Buffer.concat(out);
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(b.subarray(p, p + 2));
      p += 2;
      continue;
    }
    const len = b.readUInt16BE(p + 2);
    if (!DROP_JPEG.has(marker)) out.push(b.subarray(p, p + 2 + len));
    p += 2 + len;
  }
  out.push(b.subarray(Math.min(p, b.length)));
  return Buffer.concat(out);
}

export function stripPng(b: Buffer): Buffer {
  const sig = 8;
  const out: Buffer[] = [b.subarray(0, sig)];
  let p = sig;
  while (p + 12 <= b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString("latin1", p + 4, p + 8);
    const end = p + 12 + len;
    if (end > b.length) return b; // truncated or odd: leave it alone rather than corrupt it
    if (!["eXIf", "tEXt", "zTXt", "iTXt"].includes(type)) out.push(b.subarray(p, end));
    p = end;
  }
  if (p !== b.length) return b; // trailing bytes that are not a whole chunk: do not guess
  return Buffer.concat(out);
}

export function stripImageMetadata(b: Buffer, format: string): Buffer {
  if (format === "jpeg") return stripJpeg(b);
  if (format === "png") return stripPng(b);
  return b;
}
