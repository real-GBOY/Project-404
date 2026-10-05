/**
 * Evidence safety over the real upload path (presign → PUT → confirm → link): the content must be what it claims to be,
 * PDFs with scripts are refused, photos lose their location metadata, and confidential attachments get the same gate.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;

const seg = (marker: number, body: Buffer): Buffer => {
  const h = Buffer.from([0xff, marker, 0, 0]);
  h.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([h, body]);
};
const JPEG_WITH_GPS = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe1, Buffer.from("Exif\0\0MM\0*\0\0\0\b\0\x01\x88\x25\0\x04\0\0\0\x01\0\0\0\x1a\0\0\0\0GPS 24.7136N 46.6753E", "latin1")),
  seg(0xdb, Buffer.alloc(65, 1)),
  Buffer.from([0xff, 0xda, 0, 3, 1, 0, 1, 2, 3, 4, 0xff, 0xd9]),
]);
const PDF_PLAIN = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF");
const PDF_ACTIVE = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj\n%%EOF");

describe.skipIf(!hasTestDb)("Raqib evidence safety", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  let inspectionId = "";
  let itemId = "";

  const call = async (who: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json,
      raw: res,
    };
  };
  async function upload(who: string, name: string, type: string, bytes: Buffer): Promise<string> {
    const p = await call(who, "POST", "/files/uploads", { originalName: name, contentType: type, byteSize: bytes.length });
    expect(p.status).toBe(201);
    const put = await http.inject({
      method: "PUT",
      url: `/api${p.body.upload.url}`,
      headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/octet-stream" },
      payload: bytes,
    });
    expect(put.statusCode).toBe(204);
    expect((await call(who, "POST", `/files/${p.body.fileId}/confirm`)).status).toBe(200);
    return p.body.fileId as string;
  }
  const attach = (fileId: string) => call("insA", "POST", "/raqib/evidence", { fileId, inspectionId, itemId });

  beforeAll(async () => {
    http = (await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") })).http;
    for (const key of ["qm", "insA", "guard"]) tokens[key] = await loginAs(http, email(key));
    const visits = (await call("qm", "GET", "/raqib/visits?limit=500")).body.items as Json[];
    const v = visits.find((x) => x.site.name.en === "Parking structure")!;
    const view = (await call("insA", "POST", `/raqib/visits/${v.id}/inspection/start`)).body;
    inspectionId = view.id;
    itemId = view.sections.flatMap((s: Json) => s.items)[0].id;
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  it("refuses a file whose content is not what it claims (an HTML page filed as a JPEG)", async () => {
    const id = await upload("insA", "photo.jpg", "image/jpeg", Buffer.from("<html><script>alert(1)</script></html>"));
    const r = await attach(id);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("raqib.file_content_mismatch");
  });

  it("refuses a photo that is really a PDF, and a PDF that is really a photo", async () => {
    expect((await attach(await upload("insA", "a.jpg", "image/jpeg", PDF_PLAIN))).body.error.code).toBe("raqib.file_content_mismatch");
    expect((await attach(await upload("insA", "a.pdf", "application/pdf", JPEG_WITH_GPS))).body.error.code).toBe("raqib.file_content_mismatch");
  });

  it("refuses a PDF that carries scripts or launch actions but accepts a plain one", async () => {
    const bad = await attach(await upload("insA", "x.pdf", "application/pdf", PDF_ACTIVE));
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("raqib.pdf_active_content");
    expect((await attach(await upload("insA", "ok.pdf", "application/pdf", PDF_PLAIN))).status).toBe(201);
  });

  it("stores a photo without its location metadata, replacing the original file", async () => {
    const original = await upload("insA", "site.jpg", "image/jpeg", JPEG_WITH_GPS);
    const r = await attach(original);
    expect(r.status).toBe(201);
    const ev = r.body;
    const content = await call("insA", "GET", `/raqib/evidence/${ev.id}/content`);
    expect(content.status).toBe(200);
    const bytes = content.raw.rawPayload;
    expect(bytes.toString("latin1")).not.toContain("GPS 24.7136N");
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);

    const pg = (await import("pg")).default;
    const { TEST_DATABASE_URL } = await import("@core/tests/helpers.js");
    const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await c.connect();
    try {
      const row = (await c.query("SELECT file_id FROM raqib_evidence WHERE id = $1", [ev.id])).rows[0];
      expect(row.file_id).not.toBe(original); // the cleaned copy is the evidence
      expect((await c.query("SELECT 1 FROM files WHERE id = $1 AND deleted_at IS NOT NULL", [original])).rowCount).toBe(1); // the original (with its location data) is removed
    } finally {
      await c.end();
    }
  });

  it("applies the same gate to confidential attachments", async () => {
    const bad = await upload("guard", "note.jpg", "image/jpeg", Buffer.from("MZ not an image"));
    const res = await call("guard", "POST", "/raqib/confidential/reports", {
      kind: "violation",
      subject: "Gate left open at night",
      body: "The vehicle gate was left open from midnight until the morning shift.",
      place: "Vehicle gate",
      identity: "named",
      fileIds: [bad],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("raqib.file_content_mismatch");
    const good = await upload("guard", "photo.jpg", "image/jpeg", JPEG_WITH_GPS);
    const ok = await call("guard", "POST", "/raqib/confidential/reports", {
      kind: "violation",
      subject: "Gate left open at night",
      body: "The vehicle gate was left open from midnight until the morning shift.",
      place: "Vehicle gate",
      identity: "named",
      fileIds: [good],
    });
    expect(ok.status).toBeLessThan(300);
  });
});
