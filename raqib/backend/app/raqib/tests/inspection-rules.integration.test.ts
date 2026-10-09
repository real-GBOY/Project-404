/**
 * Two inspector rules: a visit is started on its scheduled day (unless the organization allows starting early), and an item
 * moved away from "non-compliant" drops the violation's note and cannot keep the violation's evidence.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe.skipIf(!hasTestDb)("Raqib inspector rules", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const call = async (who: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json };
  };
  async function upload(who: string): Promise<string> {
    const p = await call(who, "POST", "/files/uploads", { originalName: "photo.png", contentType: "image/png", byteSize: PNG.length });
    const put = await http.inject({
      method: "PUT",
      url: `/api${p.body.upload.url}`,
      headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/octet-stream" },
      payload: PNG,
    });
    expect(put.statusCode).toBe(204);
    expect((await call(who, "POST", `/files/${p.body.fileId}/confirm`)).status).toBe(200);
    return p.body.fileId as string;
  }
  const setEarly = async (on: boolean) => {
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    return call("qm", "PUT", "/raqib/settings", { settings: { ...cur, insp: { ...cur.insp, allowEarlyStart: on } }, reason: "early start (test)" });
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "insA"]) tokens[key] = await loginAs(http, email(key));
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  async function scheduleFor(date: string): Promise<string> {
    const mine = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.inspector?.name.en === "Khalid Al-Shehri")!;
    const made = await call("qm", "POST", "/raqib/visits", {
      projectId: mine.project.id,
      siteId: mine.site.id,
      inspectorId: mine.inspector.id,
      type: "routine",
      shift: "morning",
      date,
      time: "11:00",
      guardIds: [],
      formIds: [],
      reason: "rules test",
    });
    expect(made.status).toBe(201);
    return made.body.id as string;
  }

  it("an inspector cannot start a visit before its day unless the organization allows it", async () => {
    await setEarly(false);
    const id = await scheduleFor("2026-12-30");
    const early = await call("insA", "POST", `/raqib/visits/${id}/inspection/start`);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("raqib.too_early");
    expect((await setEarly(true)).status).toBe(200);
    expect((await call("insA", "POST", `/raqib/visits/${id}/inspection/start`)).status).toBe(200);
  });

  it("a visit scheduled for today starts normally when early starts are off", async () => {
    await setEarly(false);
    const id = await scheduleFor("2026-10-04");
    expect((await call("insA", "POST", `/raqib/visits/${id}/inspection/start`)).status).toBe(200);
  });

  it("changing a non-compliant item to compliant drops its note and needs its evidence removed first", async () => {
    await setEarly(true);
    const id = await scheduleFor("2026-12-29");
    const started = (await call("insA", "POST", `/raqib/visits/${id}/inspection/start`)).body;
    const item = (started.sections as Json[]).flatMap((s) => s.items as Json[])[0]!;
    const put = (payload: Json) => call("insA", "PUT", `/raqib/visits/${id}/inspection/answers/${item.id}`, payload);
    expect((await put({ value: "n", note: "Gate left open" })).status).toBe(200);
    const fileId = await upload("insA");
    const att = await call("insA", "POST", "/raqib/evidence", { fileId, inspectionId: started.id, itemId: item.id });
    expect(att.status).toBe(201);

    const blocked = await put({ value: "c" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("raqib.remove_evidence_first");

    expect((await call("insA", "DELETE", `/raqib/evidence/${att.body.id}`)).status).toBe(204);
    const ok = await put({ value: "c" });
    expect(ok.status).toBe(200);
    const now = (ok.body.sections as Json[]).flatMap((s) => s.items as Json[]).find((i) => i.id === item.id)!;
    expect(now.answer).toBe("c");
    expect(now.note ?? "").toBe("");
  });
});
