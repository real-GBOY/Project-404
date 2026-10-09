/**
 * Requirement 18/20: the organization's name and logo are settings that every printed document carries; a logo is supplied
 * later through the product, not through code; an issued report keeps the branding it was issued with.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe.skipIf(!hasTestDb)("Raqib branding", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json,
      text: res.body,
    };
  };
  async function upload(who: string, name: string, type: string, bytes: Buffer): Promise<string> {
    const p = await call(who, "POST", "/files/uploads", { originalName: name, contentType: type, byteSize: bytes.length });
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
  const setOrg = async (patch: Json) => {
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    return call("qm", "PUT", "/raqib/settings", { settings: { ...cur, org: { ...cur.org, ...patch } }, reason: "branding (test)" });
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "insA"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  it("documents carry the organization's name, and no logo until one is supplied", async () => {
    const report = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[])[0]!;
    const html = (await call("qm", "GET", `/raqib/reports/${report.id}/html?lang=en`)).text;
    expect(html).toContain('class="brand"');
    expect(html).toContain("Raqib Security Services Co.");
    expect(html).not.toContain('<div class="brand"><img'); // no logo has been supplied yet
    const forms = (await call("qm", "GET", "/raqib/forms")).body.items as Json[];
    const blank = (await call("qm", "GET", `/raqib/forms/${forms[0]!.id}/blank?lang=en`)).text;
    expect(blank).toContain('class="brand"');
    expect(blank).toContain("Raqib Security Services Co.");
    expect(blank).not.toContain('<div class="brand"><img');
  });

  it("accepts only a stored PNG or JPEG as the logo", async () => {
    expect((await setOrg({ logo: "fil_missing" })).status).toBe(400);
    const pdf = await upload("qm", "x.pdf", "application/pdf", Buffer.from("%PDF-1.4\n%%EOF\n"));
    expect((await setOrg({ logo: pdf })).status).toBe(400);
  });

  it("takes a logo and a new name from settings and prints them on blank forms and the schedule", async () => {
    const logo = await upload("qm", "logo.png", "image/png", PNG);
    const set = await setOrg({ logo, nameEn: "Al-Amal Guarding", nameAr: "الأمل للحراسة" });
    expect(set.status).toBe(200);
    const forms = (await call("qm", "GET", "/raqib/forms")).body.items as Json[];
    const blank = (await call("qm", "GET", `/raqib/forms/${forms[0]!.id}/blank?lang=ar`)).text;
    expect(blank).toContain("الأمل للحراسة");
    expect(blank).toContain("data:image/png;base64,");
    const schedule = (await call("qm", "GET", "/raqib/visits/print?from=2026-06-01&to=2027-05-31&lang=en")).text;
    expect(schedule).toContain("Al-Amal Guarding");
    expect(schedule).toContain("data:image/png;base64,");
  });

  it("freezes the branding into a report when it is issued, so a later rename does not change it", async () => {
    // issue a fresh report under the new name
    const visit = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.status === "pending_approval")!;
    expect((await call("qm", "POST", `/raqib/visits/${visit.id}/review/approve`, {})).status).toBe(200);
    const report = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[]).find((r) => r.visitId === visit.id)!;
    expect(report.snapshot.org.name.en).toBe("Al-Amal Guarding");
    expect(report.snapshot.org.logoFileId).toBeTruthy();
    expect((await setOrg({ nameEn: "Renamed Again", nameAr: "اسم جديد" })).status).toBe(200);
    const html = (await call("qm", "GET", `/raqib/reports/${report.id}/html?lang=en`)).text;
    expect(html).toContain("Al-Amal Guarding");
    expect(html).not.toContain("Renamed Again");
    expect(html).toContain("data:image/png;base64,");
  });
});
