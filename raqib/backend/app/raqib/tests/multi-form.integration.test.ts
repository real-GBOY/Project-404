/**
 * Several forms in one visit: the scheduler names the forms, the inspector completes each (every one with its own issue
 * number), the visit is submitted and reviewed as a whole, and the issued report carries every form. Visits that name
 * no forms keep working exactly as before.
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

describe.skipIf(!hasTestDb)("Raqib visits with several forms", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  let base: { projectId: string; siteId: string; inspectorId: string };
  let secId = "";
  let logId = "";
  let guardFormId = "";
  let draftOnlyId = "";
  let visitId = "";

  const call = async (who: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json,
      text: res.body,
    };
  };
  const answerAll = async (view: Json, value: "c" | "n") => {
    for (const it of view.sections.flatMap((s: Json) => s.items) as Json[]) {
      expect((await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/answers/${it.id}`, { value })).status).toBe(200);
    }
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "insA", "pm"]) tokens[key] = await loginAs(http, email(key));
    const mine = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.inspector?.name.en === "Khalid Al-Shehri")!;
    base = { projectId: mine.project.id, siteId: mine.site.id, inspectorId: mine.inspector.id };
    const forms = (await call("qm", "GET", "/raqib/forms")).body.items as Json[];
    secId = forms.find((f) => f.code === "FRM-SEC-01")!.id;
    logId = forms.find((f) => f.code === "FRM-HSP-01")!.id;
    draftOnlyId = (await call("qm", "GET", "/raqib/forms")).body.items.find((f: Json) => f.code === "FRM-LOG-01").id;
    guardFormId = forms.find((f) => f.category === "guard")!.id;
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  const schedule = (formIds: string[]) =>
    call("qm", "POST", "/raqib/visits", {
      ...base,
      type: "routine",
      shift: "morning",
      date: "2026-12-20",
      time: "09:00",
      guardIds: [],
      formIds,
      reason: "multi-form",
    });

  it("accepts only active, published site forms", async () => {
    expect((await schedule([guardFormId])).status).toBe(400);
    expect((await schedule([draftOnlyId])).status).toBe(400); // never published
    expect((await schedule(["frm_missing"])).status).toBe(400);
    const ok = await schedule([secId, logId]);
    expect(ok.status).toBe(201);
    visitId = ok.body.id;
    expect(ok.body.forms.map((f: Json) => f.code)).toEqual(["FRM-SEC-01", "FRM-HSP-01"]);
  });

  it("starts each form on its own, with a unique issue number, and lists their progress", async () => {
    const first = await call("insA", "POST", `/raqib/visits/${visitId}/inspection/start`);
    expect(first.status).toBe(200);
    expect(first.body.form.code).toBe("FRM-SEC-01");
    expect(first.body.issueNo).toMatch(/^INS-26-\d{4}$/);
    const second = await call("insA", "POST", `/raqib/visits/${visitId}/inspection/start?formId=${logId}`);
    expect(second.status).toBe(200);
    expect(second.body.form.code).toBe("FRM-HSP-01");
    expect(second.body.issueNo).not.toBe(first.body.issueNo);
    expect(second.body.guardCriteria).toHaveLength(0); // the guard evaluation belongs to the first form only
    expect((await call("insA", "POST", `/raqib/visits/${visitId}/inspection/start?formId=${guardFormId}`)).status).toBe(404);
    // starting again returns the same inspection
    expect((await call("insA", "POST", `/raqib/visits/${visitId}/inspection/start?formId=${logId}`)).body.id).toBe(second.body.id);

    const list = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection/forms`)).body.items as Json[];
    expect(list.map((f) => [f.code, f.started, f.position])).toEqual([
      ["FRM-SEC-01", true, 0],
      ["FRM-HSP-01", true, 1],
    ]);
    expect(list.every((f) => f.blocking > 0)).toBe(true);
    expect((await call("insA", "GET", `/raqib/visits/${visitId}/inspection?formId=${logId}`)).body.id).toBe(second.body.id);
    expect((await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body.id).toBe(first.body.id);
    expect((await call("qm", "GET", `/raqib/visits/${visitId}`)).body.storedStatus).toBe("in_progress");
  });

  it("answers land in the form that owns the item, and the visit cannot be submitted until every form is complete", async () => {
    const a = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
    const b = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection?formId=${logId}`)).body;
    await answerAll(b, "c");
    const refreshedB = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection?formId=${logId}`)).body;
    expect(refreshedB.score.answered).toBe(refreshedB.score.total);
    expect((await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body.score.answered).toBe(0);
    const blocked = await call("insA", "POST", `/raqib/visits/${visitId}/inspection/submit`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("raqib.cannot_submit");
    expect((blocked.body.error.details.issues as Json[]).every((x) => x.form === "FRM-SEC-01")).toBe(true);
    await answerAll(a, "c");
  });

  it("submits every form together, scoring each, and shows reviewers the mean for the visit", async () => {
    const res = await call("insA", "POST", `/raqib/visits/${visitId}/inspection/submit`);
    expect(res.status).toBe(200);
    const rows = await ownerQuery<{ issue_no: string; score_pct: number; submitted_at: Date | null }>(
      `SELECT issue_no, score_pct, submitted_at FROM raqib_inspections WHERE visit_id = $1 ORDER BY issue_no`,
      [visitId],
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.score_pct === 100 && r.submitted_at)).toBe(true);
    const seen = await call("qe", "GET", `/raqib/visits/${visitId}`);
    expect(seen.body.scorePct).toBe(100);
    expect(seen.body.forms).toHaveLength(2);
    expect((await call("qe", "GET", `/raqib/visits/${visitId}/inspection/forms`)).body.items.map((f: Json) => f.submitted)).toEqual([true, true]);
  });

  it("is reviewed and approved as one visit, and the report carries both forms", async () => {
    expect((await call("qe", "POST", `/raqib/visits/${visitId}/review/forward`, {})).status).toBe(200);
    expect((await call("qm", "POST", `/raqib/visits/${visitId}/review/approve`, {})).status).toBe(200);
    const report = (await call("qm", "GET", "/raqib/reports")).body.items.find((r: Json) => r.visitId === visitId);
    expect(report).toBeDefined();
    const full = (await call("qm", "GET", `/raqib/reports/${report.id}`)).body;
    expect(full.snapshot.issueNo).toMatch(/^INS-26-/);
    expect(full.snapshot.extraForms).toHaveLength(1);
    expect(full.snapshot.extraForms[0].form.code).toBe("FRM-HSP-01");
    expect(full.snapshot.overallPct).toBe(100);
    const html = (await call("qm", "GET", `/raqib/reports/${report.id}/html?lang=en`)).text;
    expect(html).toContain("FRM-SEC-01");
    expect(html).toContain("FRM-HSP-01");
    expect(html).toContain(full.snapshot.extraForms[0].issueNo);
  });

  it("still works for a visit that names no forms (the default site form)", async () => {
    const plain = await call("qm", "POST", "/raqib/visits", {
      ...base,
      type: "routine",
      shift: "morning",
      date: "2026-12-21",
      time: "09:00",
      guardIds: [],
      reason: "plain",
    });
    expect(plain.status).toBe(201);
    expect(plain.body.forms.map((f: Json) => f.code)).toEqual(["FRM-SEC-01"]); // the default site form
    const started = await call("insA", "POST", `/raqib/visits/${plain.body.id}/inspection/start`);
    expect(started.status).toBe(200);
    expect(started.body.issueNo).toMatch(/^INS-26-/);
  });
});
