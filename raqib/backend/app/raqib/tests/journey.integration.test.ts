/**
 * The most important journey, end to end, on the real application and database:
 *
 *   Quality Management schedules a visit with two forms → the inspector sees it, starts both, evaluates, attaches evidence
 *   and submits → the score is the deduction score → quality reviews and approves → the finding becomes an observation
 *   with a corrective action under the project manager → the manager resolves it, quality verifies and closes it →
 *   the issued report carries both forms → analytics reflect the stored records.
 *
 * Then the things that must hold independently: who cannot see what, what cannot be changed, and what is refused.
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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe.skipIf(!hasTestDb)("Raqib end-to-end journey", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const state: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json,
      text: res.body,
    };
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
  const inspection = (formId?: string) => call("insA", "GET", `/raqib/visits/${state.visitId}/inspection${formId ? `?formId=${formId}` : ""}`);

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "sultan", "insA", "insB", "gm", "gs", "guard", "adm"]) tokens[key] = await loginAs(http, email(key));
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("1. configuration by the people authorised to make it", () => {
    it("the General Manager names the scoring manager, who publishes the approved deduction values", async () => {
      const qmId = (await call("qm", "GET", "/raqib/me")).body.id;
      expect((await call("gm", "POST", "/raqib/scoring/designees", { userId: qmId })).status).toBe(204);
      const v1 = await call("qm", "PUT", "/raqib/scoring", { bySeverity: { low: 2, medium: 5, high: 10 }, byItem: {}, reason: "Journey: approved table" });
      expect(v1.body.version).toBe(1);
    });
  });

  describe("2. schedule → inspect → submit", () => {
    it("Quality Management schedules one visit that requires two forms, and the inspector sees it", async () => {
      const mine = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.inspector?.name.en === "Khalid Al-Shehri")!;
      const forms = (await call("qm", "GET", "/raqib/visits/forms/available")).body.items as Json[];
      expect(forms.map((f) => f.code).sort()).toEqual(["FRM-HSP-01", "FRM-SEC-01"]);
      state.secId = forms.find((f) => f.code === "FRM-SEC-01")!.id;
      state.hspId = forms.find((f) => f.code === "FRM-HSP-01")!.id;
      const made = await call("qm", "POST", "/raqib/visits", {
        projectId: mine.project.id,
        siteId: mine.site.id,
        inspectorId: mine.inspector.id,
        type: "routine",
        shift: "morning",
        date: "2026-12-30",
        time: "10:00",
        guardIds: [],
        formIds: [state.secId, state.hspId],
        reason: "Journey visit",
      });
      expect(made.status).toBe(201);
      expect(made.body.storedStatus).toBe("assigned");
      state.visitId = made.body.id;
      state.projectId = mine.project.id;
      // the visit carries the data the inspector should not have to type again
      expect(made.body).toMatchObject({ shift: "morning", date: "2026-12-30", time: "10:00" });
      const seen = ((await call("insA", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.id === state.visitId)!;
      expect(seen.forms.map((f: Json) => f.code)).toEqual(["FRM-SEC-01", "FRM-HSP-01"]);
      expect(seen.scorePct).toBeNull();
    });

    it("the inspector evaluates both forms: one violation with a note and evidence, everything else compliant", async () => {
      const sec = (await call("insA", "POST", `/raqib/visits/${state.visitId}/inspection/start`)).body;
      const hsp = (await call("insA", "POST", `/raqib/visits/${state.visitId}/inspection/start?formId=${state.hspId}`)).body;
      expect(sec.issueNo).not.toBe(hsp.issueNo);
      state.secInspection = sec.id;
      state.hspInspection = hsp.id;
      const answer = (itemId: string, patch: Json) => call("insA", "PUT", `/raqib/visits/${state.visitId}/inspection/answers/${itemId}`, patch);
      const secItems = sec.sections.flatMap((s: Json) => s.items) as Json[];
      const nc = secItems[1]!;
      state.ncKey = nc.key;
      for (const it of secItems) expect((await answer(it.id, { value: it.id === nc.id ? "n" : "c" })).status).toBe(200);
      expect((await answer(nc.id, { note: "Visitor log not signed", severity: "high" })).status).toBe(200);
      expect((await call("insA", "POST", "/raqib/evidence", { fileId: await upload("insA"), inspectionId: sec.id, itemId: nc.id })).status).toBe(201);
      for (const it of hsp.sections.flatMap((s: Json) => s.items) as Json[]) await answer(it.id, { value: "c" });
      const progress = (await call("insA", "GET", `/raqib/visits/${state.visitId}/inspection/forms`)).body.items as Json[];
      expect(progress.map((f) => f.blocking)).toEqual([0, 0]);
    });

    it("submits the whole visit; each form is scored by the approved deductions, and the inspector never sees a score", async () => {
      const done = await call("insA", "POST", `/raqib/visits/${state.visitId}/inspection/submit`);
      expect(done.status).toBe(200);
      expect(done.body.score.pct).toBeNull();
      const rows = await ownerQuery<{ score_pct: number; scoring_policy: string; submitted_at: Date }>(
        `SELECT score_pct, scoring_policy, submitted_at FROM raqib_inspections WHERE visit_id = $1 ORDER BY issue_no`,
        [state.visitId],
      );
      expect(rows.map((r) => [r.scoring_policy, r.score_pct])).toEqual([
        ["deduction_v1", 90],
        ["deduction_v1", 100],
      ]);
      expect(rows.every((r) => r.submitted_at)).toBe(true);
      const dedu = await ownerQuery<{ amount: number }>(
        `SELECT d.amount FROM raqib_inspection_deductions d JOIN raqib_inspections i ON i.id = d.inspection_id WHERE i.visit_id = $1`,
        [state.visitId],
      );
      expect(dedu).toEqual([{ amount: 10 }]);
      expect(((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.id === state.visitId)!.scorePct).toBe(95);
    });
  });

  describe("3. review → approval → corrective action → verification", () => {
    it("quality reviews, the director approves, and the finding becomes an observation linked to its form and item", async () => {
      expect((await call("qe", "POST", `/raqib/visits/${state.visitId}/review/forward`, {})).status).toBe(200);
      expect((await call("qm", "POST", `/raqib/visits/${state.visitId}/review/approve`, {})).status).toBe(200);
      const obs = ((await call("qm", "GET", "/raqib/observations")).body.items as Json[]).find((o) => o.visit?.id === state.visitId)!;
      expect(obs).toMatchObject({ kind: "violation", severity: "high", itemKey: state.ncKey });
      expect(obs.form.code).toBe("FRM-SEC-01");
      expect(obs.form.issueNo).toMatch(/^INS-26-/);
      state.observationId = obs.id;
      // a high-severity finding told the project manager immediately
      const told = ((await call("pm", "GET", "/notifications")).body.notifications as Json[]).some((n) => n.type === "raqib.observation_high");
      expect(told).toBe(true);
    });

    it("quality assigns the corrective action to the project manager, who resolves it with evidence; quality verifies and closes it", async () => {
      const eligible = (await call("qm", "GET", `/raqib/actions/responsible?projectId=${state.projectId}`)).body.items as Json[];
      const fahad = eligible.find((p) => p.name.en === "Fahad Al-Dosari")!;
      const created = await call("qm", "POST", `/raqib/observations/${state.observationId}/action`, {
        responsibleId: fahad.id,
        dueDate: "2027-01-15",
        priority: "high",
        description: "Reinstate the visitor log check",
      });
      expect(created.status).toBe(201);
      state.actionId = created.body.id;
      expect((await call("pm", "POST", `/raqib/actions/${state.actionId}/start`)).status).toBe(200);
      // nothing is closed on the manager's say-so alone: evidence first, and only quality closes
      expect((await call("pm", "POST", `/raqib/actions/${state.actionId}/submit`)).body.error.code).toBe("raqib.evidence_required");
      expect((await call("pm", "POST", "/raqib/evidence", { fileId: await upload("pm"), actionId: state.actionId })).status).toBe(201);
      expect((await call("pm", "POST", `/raqib/actions/${state.actionId}/submit`)).status).toBe(200);
      expect((await call("pm", "POST", `/raqib/actions/${state.actionId}/close`, {})).status).toBe(403);
      const closed = await call("qm", "POST", `/raqib/actions/${state.actionId}/close`, { comment: "Verified on site" });
      expect(closed.body.status).toBe("closed");
      expect(closed.body.log.map((l: Json) => l.kind)).toEqual(["created", "started", "submitted", "closed"]);
      expect(closed.body).toMatchObject({ escalationLevel: 0 });
      expect(typeof closed.body.elapsedDays).toBe("number");
    });
  });

  describe("4. the report and the analytics", () => {
    it("the issued report carries both forms, the deduction and the decision trail", async () => {
      const report = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[]).find((r) => r.visitId === state.visitId)!;
      expect(report.scorePct).toBe(95);
      expect(report.snapshot.extraForms).toHaveLength(1);
      const html = (await call("qm", "GET", `/raqib/reports/${report.id}/html?lang=ar`)).text;
      expect(html).toContain('dir="rtl"');
      for (const needle of ["FRM-SEC-01", "FRM-HSP-01", report.snapshot.issueNo, report.snapshot.extraForms[0].issueNo, "−10", "thead"])
        expect(html).toContain(needle);
      expect(html).toMatch(/counter\(page\)/);
      // blank, printable copies exist for every form
      const blank = await call("insA", "GET", `/raqib/forms/${state.secId}/blank?lang=en`);
      expect(blank.status).toBe(200);
      expect(blank.text).toContain("FRM-SEC-01");
      expect(blank.text).toContain('class="box"');
    });

    it("analytics are computed from what was stored", async () => {
      // the test clock stands at 4 Oct 2026 while the database stamps real creation times, so ask for a range that holds both
      const a = (await call("qm", "GET", "/raqib/analytics?period=custom&from=2026-01-01&to=2026-12-31")).body;
      expect(a.closure.n).toBeGreaterThanOrEqual(1);
      expect(a.observationSummary.bySeverity.high).toBeGreaterThanOrEqual(1);
      expect(a.ranking.length).toBeGreaterThan(0);
      expect(a.training).toHaveProperty("requested");
    });
  });

  describe("5. what must hold independently", () => {
    it("inspectors reach neither scores nor analytics; project managers only their own projects", async () => {
      expect((await call("insA", "GET", "/raqib/analytics")).status).toBe(403);
      expect((await call("insA", "GET", "/raqib/reports")).status).toBe(403);
      expect((await inspection()).body.score.visible).toBe(false);
      // sultan manages another project: the journey visit, its observation and its action are invisible to him
      const out = [
        await call("sultan", "GET", `/raqib/visits/${state.visitId}`),
        await call("sultan", "GET", `/raqib/observations/${state.observationId}`),
        await call("sultan", "GET", `/raqib/actions/${state.actionId}`),
        await call("sultan", "GET", `/raqib/visits/${state.visitId}/inspection`),
      ];
      expect(out.map((r) => r.status).every((s) => s === 403 || s === 404)).toBe(true);
      expect(((await call("sultan", "GET", "/raqib/observations")).body.items as Json[]).some((o) => o.id === state.observationId)).toBe(false);
    });

    it("the confidential area stays closed to everyone without a grant, whatever their role", async () => {
      for (const who of ["qm", "qe", "pm", "insA", "gs", "adm"])
        expect((await call(who, "GET", "/raqib/confidential/reports")).status).toBeGreaterThanOrEqual(400);
    });

    it("nobody but the designated manager changes deductions, and system fields stay put", async () => {
      for (const who of ["qe", "pm", "insA", "gm", "adm"]) {
        expect((await call(who, "PUT", "/raqib/scoring", { bySeverity: { high: 1 }, byItem: {}, reason: "should not work" })).status).toBe(403);
      }
      const url = `/raqib/inspections/${state.secInspection}/corrections`;
      expect((await call("insA", "POST", url, { field: "deduction_amount", value: 0, itemKey: state.ncKey, reason: "wipe it out" })).status).toBe(403);
      expect((await call("qe", "POST", url, { field: "deduction_amount", value: 0, itemKey: state.ncKey, reason: "wipe it out" })).status).toBe(403);
      // an inspector has no route that sets timestamps, issue numbers or scores at all
      for (const path of [`/raqib/visits/${state.visitId}/inspection`, `/raqib/visits/${state.visitId}/inspection/submit`]) {
        const put = await call("insA", "PUT", path, { score_pct: 100, issue_no: "INS-00-0000" });
        expect([404, 405]).toContain(put.status);
      }
      const stored = await ownerQuery<{ issue_no: string; score_pct: number }>(`SELECT issue_no, score_pct FROM raqib_inspections WHERE id = $1`, [
        state.secInspection,
      ]);
      expect(stored[0]).toMatchObject({ score_pct: 90 });
      expect(stored[0]!.issue_no).toMatch(/^INS-26-/);
    });

    it("publishing new deduction rules does not move a report that was already issued", async () => {
      const before = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[]).find((r) => r.visitId === state.visitId)!;
      const v2 = await call("qm", "PUT", "/raqib/scoring", { bySeverity: { high: 50 }, byItem: {}, reason: "Journey: stricter table" });
      expect(v2.body.version).toBe(2);
      const after = ((await call("qm", "GET", "/raqib/reports")).body.items as Json[]).find((r) => r.visitId === state.visitId)!;
      expect(after.snapshot).toEqual(before.snapshot);
      expect(after.scorePct).toBe(95);
    });

    it("the backend refuses moves the workflow does not allow", async () => {
      expect((await call("qm", "POST", `/raqib/visits/${state.visitId}/review/approve`, {})).status).toBe(409); // already approved
      expect((await call("insA", "POST", `/raqib/visits/${state.visitId}/inspection/submit`)).status).toBe(409); // locked
      expect((await call("pm", "POST", `/raqib/actions/${state.actionId}/start`)).body.error.code).toBe("raqib.invalid_transition"); // closed
      expect((await call("qm", "POST", `/raqib/visits/${state.visitId}/review/return`, { reason: "too late" })).status).toBe(409);
      expect((await call("qm", "POST", `/raqib/visits/${state.visitId}/review/reject`, {})).status).toBe(400); // a reason is required
    });
  });
});
