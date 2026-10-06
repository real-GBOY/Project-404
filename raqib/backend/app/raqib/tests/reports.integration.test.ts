/**
 * Phase 5 — approved reports: frozen at approval inside the approval transaction, immutable, scoped, audited, and
 * rendered to PDF from the snapshot (never from live data).
 */
import pg from "pg";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasTestDb)("Raqib reports", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const call = async (who: string, method: "GET" | "POST", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json,
      raw: res.rawPayload,
      headers: res.headers,
    };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "insA", "gm"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  it("every approved inspection has exactly one frozen report", async () => {
    const approved = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).filter((v) => v.status === "approved");
    const reports = (await call("qm", "GET", "/raqib/reports")).body.items as Json[];
    expect(approved.length).toBe(3);
    expect(reports.map((r) => r.visitId).sort()).toEqual(approved.map((v) => v.id).sort());
    const r = reports[0]!;
    expect(r.ref).toMatch(/^RPT-\d\d-\d{4}$/);
    expect(r.snapshot.sections.length).toBeGreaterThan(0);
    expect(r.snapshot.approvedBy.title.en).toBe("Director of Quality");
    expect(r.snapshot.decisions.map((d: Json) => d.action)).toContain("approved");
  });

  it("pending, returned and rejected inspections have no report", async () => {
    const all = (await call("qm", "GET", "/raqib/visits")).body.items as Json[];
    const reports = (await call("qm", "GET", "/raqib/reports")).body.items as Json[];
    const ids = new Set(reports.map((r) => r.visitId));
    for (const v of all.filter((x) => ["pending_review", "pending_approval", "returned", "rejected"].includes(x.status))) expect(ids.has(v.id)).toBe(false);
  });

  it("is scoped by project and by the reports permission", async () => {
    const pm = (await call("pm", "GET", "/raqib/reports")).body.items as Json[];
    expect(pm.every((r) => r.snapshot.project.code === "PRJ-RYD-014")).toBe(true);
    const mine = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[]).find((r) => r.snapshot.project.code !== "PRJ-RYD-014")!;
    expect((await call("pm", "GET", `/raqib/reports/${mine.id}`)).status).toBe(403);
    expect((await call("insA", "GET", "/raqib/reports")).status).toBe(403);
    expect((await call("qm", "GET", "/raqib/reports/rep_missing")).status).toBe(404);
  });

  it("an issued report cannot be changed or deleted, even by the database owner", async () => {
    const r = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[])[0]!;
    await expect(ownerQuery(`UPDATE raqib_reports SET score_pct = 1 WHERE id = $1`, [r.id])).rejects.toThrow(/immutable/);
    await expect(ownerQuery(`DELETE FROM raqib_reports WHERE id = $1`, [r.id])).rejects.toThrow(/immutable/);
  });

  it("later edits to the project do not change the issued report", async () => {
    const before = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[])[0]!;
    await ownerQuery(`UPDATE raqib_projects SET name_en = 'Renamed Later' WHERE id = $1`, [before.projectId]);
    try {
      const after = (await call("qm", "GET", `/raqib/reports/${before.id}`)).body;
      expect(after.snapshot.project.name.en).toBe(before.snapshot.project.name.en);
      expect(after.snapshot.project.name.en).not.toBe("Renamed Later");
    } finally {
      await ownerQuery(`UPDATE raqib_projects SET name_en = $2 WHERE id = $1`, [before.projectId, before.snapshot.project.name.en]);
    }
  });

  it("the printable report needs the download right, is built from the frozen snapshot in either language, and is audited", async () => {
    const r = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[])[0]!;
    expect((await call("insA", "GET", `/raqib/reports/${r.id}/html`)).status).toBe(403);
    expect((await call("qm", "GET", `/raqib/reports/${r.id}/html?lang=fr`)).status).toBe(400);
    expect((await call("qm", "GET", `/raqib/reports/nope/html`)).status).toBe(404);
    for (const [lang, dir] of [
      ["en", "ltr"],
      ["ar", "rtl"],
    ] as const) {
      const res = await call("qm", "GET", `/raqib/reports/${r.id}/html?lang=${lang}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.headers["cache-control"]).toContain("no-store");
      const html = res.raw.toString("utf8");
      expect(html).toContain(r.ref);
      expect(html).toContain(`dir="${dir}"`);
      expect(html).not.toMatch(/<script/i); // a static page: nothing in it runs
    }
    const audit = await ownerQuery(`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'raqib.report.downloaded' AND resource_id = $1`, [r.id]);
    expect(audit[0]!.n).toBe(2);
  });
});
