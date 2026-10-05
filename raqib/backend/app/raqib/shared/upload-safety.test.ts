import net from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import { clamdScan } from "./clamav.js";
import { pdfActiveContent, sniff } from "./content-sniff.js";
import { jpegOrientation, stripJpeg, stripPng } from "./image-sanitize.js";

const seg = (marker: number, body: Buffer): Buffer => {
  const h = Buffer.from([0xff, marker, 0, 0]);
  h.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([h, body]);
};
/** A big-endian EXIF block with Orientation and a GPS pointer, as a phone writes it. */
const exif = (orientation: number): Buffer => {
  const tiff = Buffer.from([
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0,
    0,
    0,
    8,
    0,
    2,
    0x01,
    0x12,
    0,
    3,
    0,
    0,
    0,
    1,
    0,
    orientation,
    0,
    0,
    0x88,
    0x25,
    0,
    4,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0x2a,
    0,
    0,
    0,
    0,
  ]);
  return Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
};
const jpeg = (orientation?: number): Buffer =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    ...(orientation ? [seg(0xe1, exif(orientation))] : []),
    seg(0xfe, Buffer.from("shot at 24.7136,46.6753")),
    seg(0xdb, Buffer.alloc(65, 1)),
    Buffer.from([0xff, 0xda, 0, 3, 1, 0, 1, 2, 3, 4, 0xff, 0xd9]),
  ]);

describe("sniff", () => {
  it("recognises evidence formats by content", () => {
    expect(sniff(jpeg())).toEqual({ kind: "photo", format: "jpeg" });
    expect(sniff(Buffer.from("89504e470d0a1a0a0000000d", "hex"))?.format).toBe("png");
    expect(sniff(Buffer.from("%PDF-1.7\n"))?.kind).toBe("doc");
    expect(sniff(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom")]))).toEqual({ kind: "video", format: "mp4" });
    expect(sniff(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypqt  ")]))?.format).toBe("mov");
    expect(sniff(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypheic")]))).toEqual({ kind: "photo", format: "heic" });
    expect(sniff(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))?.format).toBe("webp");
  });

  it("refuses everything else, however it is named", () => {
    for (const bad of ["MZ\x90\0\x03\0\0\0", "<html><script>alert(1)</script>", "#!/bin/sh\nrm -rf /", "PK\x03\x04", ""])
      expect(sniff(Buffer.from(bad, "latin1"))).toBeNull();
  });

  it("flags PDFs that run things when opened", () => {
    expect(pdfActiveContent(Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj"))).toBeNull();
    expect(pdfActiveContent(Buffer.from("%PDF-1.4\n<</OpenAction<</S/JavaScript/JS(app.alert(1))>>>>"))).not.toBeNull();
    expect(pdfActiveContent(Buffer.from("%PDF-1.4\n<</Launch<</F(cmd.exe)>>>>"))).not.toBeNull();
  });
});

describe("image metadata stripping", () => {
  it("removes EXIF, GPS and comments from a JPEG but keeps the picture", () => {
    const src = jpeg(6);
    const out = stripJpeg(src);
    const text = out.toString("latin1");
    expect(text).not.toContain("24.7136");
    expect(out.length).toBeLessThan(src.length + 30);
    expect(out.subarray(-12).equals(src.subarray(-12))).toBe(true); // scan data and end-of-image survive
    expect(sniff(out)?.format).toBe("jpeg");
  });

  it("keeps the orientation so photos do not turn sideways, and nothing else from EXIF", () => {
    expect(jpegOrientation(jpeg(6))).toBe(6);
    const out = stripJpeg(jpeg(6));
    expect(jpegOrientation(out)).toBe(6);
    expect(out.toString("latin1")).not.toContain("\x88\x25"); // the GPS pointer tag is gone
  });

  it("writes no EXIF at all for an upright photo", () => {
    const out = stripJpeg(jpeg(1));
    expect(out.toString("latin1")).not.toContain("Exif");
    expect(jpegOrientation(out)).toBeNull();
  });

  it("strips text and EXIF chunks from a PNG", () => {
    const chunk = (type: string, data: Buffer): Buffer => {
      const h = Buffer.alloc(8);
      h.writeUInt32BE(data.length);
      h.write(type, 4, "latin1");
      return Buffer.concat([h, data, Buffer.alloc(4)]);
    };
    const png = Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      chunk("IHDR", Buffer.alloc(13)),
      chunk("tEXt", Buffer.from("Location\0Riyadh")),
      chunk("eXIf", Buffer.from("secret")),
      chunk("IDAT", Buffer.from([1, 2, 3])),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    const out = stripPng(png);
    expect(out.toString("latin1")).not.toContain("Riyadh");
    expect(out.toString("latin1")).not.toContain("secret");
    expect(out.toString("latin1")).toContain("IDAT");
    expect(out.toString("latin1")).toContain("IEND");
  });

  it("leaves a truncated PNG untouched rather than corrupting it", () => {
    const broken = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from([0, 0, 1, 0, 0x49, 0x44, 0x41, 0x54, 9, 9])]);
    expect(stripPng(broken)).toBe(broken);
  });
});

describe("clamd client", () => {
  const servers: net.Server[] = [];
  afterAll(() => servers.forEach((s) => s.close()));
  const fake = (reply: string): Promise<number> =>
    new Promise((resolve) => {
      const s = net.createServer((sock) => {
        let got = Buffer.alloc(0);
        sock.on("data", (d) => {
          got = Buffer.concat([got, d]);
          if (got.subarray(-4).equals(Buffer.alloc(4)) && got.includes("zINSTREAM")) sock.end(reply + "\0");
        });
      });
      servers.push(s);
      s.listen(0, "127.0.0.1", () => resolve((s.address() as net.AddressInfo).port));
    });

  it("reports a clean file, a detection, and an unreachable daemon", async () => {
    expect(await clamdScan(Buffer.from("hello"), "127.0.0.1", await fake("stream: OK"))).toEqual({ clean: true });
    expect(await clamdScan(Buffer.alloc(200_000, 1), "127.0.0.1", await fake("stream: Eicar-Signature FOUND"))).toEqual({
      clean: false,
      signature: "Eicar-Signature",
    });
    await expect(clamdScan(Buffer.from("x"), "127.0.0.1", 1, 1000)).rejects.toBeDefined();
    await expect(clamdScan(Buffer.from("x"), "127.0.0.1", await fake("INSTREAM size limit exceeded. ERROR"))).rejects.toThrow(/unexpected/);
  });
});
