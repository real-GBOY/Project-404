/**
 * Phase 6a — observations and corrective actions: violations come from approved inspections (with repeat counts),
 * the action workflow separates doing the work, reviewing it and closing it, evidence is private, everything is
 * scoped by project, and overdue work is announced once. All over real HTTP.
 */
import pg from "pg";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { JobsRunner } from "@raqib/raqib/jobs/jobs-runner.js";
import { createDemoHttpApp, get, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasTestDb)("Raqib observations and corrective actions", () => {
  let http: NestFastifyApplication;
  let runner: JobsRunner;
  const tokens: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json };
  };
  const actions = async (who = "qm") => (await call(who, "GET", "/raqib/actions")).body.items as Json[];
  const observations = async (who = "qm") => (await call(who, "GET", "/raqib/observations")).body.items as Json[];
  const byStatus = async (status: string, who = "qm") => (await actions(who)).filter((a) => a.status === status);
  const upload = async (who: string): Promise<string> => {
    const p = await call(who, "POST", "/files/uploads", { originalName: "closure.png", contentType: "image/png", byteSize: PNG.length });
    await http.inject({ method: "PUT", url: `/api${p.body.upload.url}`, headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/octet-stream" }, payload: PNG });
    await call(who, "POST", `/files/${p.body.fileId}/confirm`);
    return p.body.fileId as string;
  };
  const notifications = async (who: string) => (await call(who, "GET", "/notifications")).body.notifications as Json[];

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    runner = get<JobsRunner>(booted.moduleRef, JobsRunner);
    for (const key of ["qm", "qe", "pm", "sultan", "buqami", "insA", "insB", "gs", "gm"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("observations", () => {
    it("records a violation for every non-compliant item of the approved inspections", async () => {
      const all = await observations();
      const violations = all.filter((o) => o.kind === "violation");
      // approved-1 (4 items) + approved-2 (2) + approved-3 (1)
      expect(violations).toHaveLength(7);
      expect(violations.every((o) => o.visit?.ref && o.itemNum && o.severity)).toBe(true);
      expect(all.filter((o) => o.kind === "observation")).toHaveLength(2);
    });

    it("is scoped: a project manager sees only their projects, an inspector cannot list but can report", async () => {
      expect((await observations("pm")).every((o) => o.project.code === "PRJ-RYD-014")).toBe(true);
      expect((await call("insA", "GET", "/raqib/observations")).status).toBe(403);
      const site = (await call("qm", "GET", "/raqib/projects")).body.items.find((p: Json) => p.code === "PRJ-RYD-014");
      const created = await call("insA", "POST", "/raqib/observations", { projectId: site.id, siteId: site.sites[0].id, text: "Radio left unattended at the gate", severity: "low" });
      expect(created.status).toBe(201);
      expect(created.body.kind).toBe("observation");
      // the inspector's scope is p1 only
      const other = (await call("qm", "GET", "/raqib/projects")).body.items.find((p: Json) => p.code === "PRJ-JED-007");
      expect((await call("insA", "POST", "/raqib/observations", { projectId: other.id, siteId: other.sites[0].id, text: "Out of scope finding", severity: "low" })).status).toBe(403);
    });

    it("counts repeats of the same form item at the same site, once, at the moment the finding is recorded", async () => {
      const pending = (await call("qm", "GET", "/raqib/visits")).body.items.find((v: Json) => v.status === "pending_approval");
      const insp = (await call("qm", "GET", `/raqib/visits/${pending.id}/inspection`)).body;
      const nc = insp.sections.flatMap((s: Json) => s.items).filter((i: Json) => i.answer === "n");
      expect(nc.length).toBeGreaterThan(0);
      const first = nc[0];
      // an earlier finding of the same item at the same site
      await ownerQuery(
        `INSERT INTO raqib_observations (id, organization_id, ref, kind, project_id, site_id, item_key, title_ar, title_en, severity, reported_by_name_ar, reported_by_name_en)
         SELECT 'obs_prior_1', v.organization_id, 'OBS-25-9999', 'violation', v.project_id, v.site_id, $2, 'x', 'x', 'medium', 'x', 'x' FROM raqib_visits v WHERE v.id = $1`,
        [pending.id, first.key],
      );
      expect((await call("qm", "POST", `/raqib/visits/${pending.id}/review/approve`, {})).status).toBe(200);
      const recorded = (await observations()).filter((o) => o.visit?.id === pending.id);
      expect(recorded).toHaveLength(nc.length);
      expect(recorded.find((o) => o.itemKey === first.key)!.repeatCount).toBe(1);
      expect(recorded.filter((o) => o.itemKey !== first.key).every((o) => o.repeatCount === 0)).toBe(true);
      // and the issued report froze them
      const report = (await call("qm", "GET", "/raqib/reports")).body.items.find((r: Json) => r.visitId === pending.id);
      expect(report.snapshot.violations).toHaveLength(nc.length);
    });
  });

  describe("the demo has actions in every state", () => {
    it("seeds assigned, overdue, in progress, quality review, returned and closed actions", async () => {
      const all = await actions();
      const count = (s: string) => all.filter((a) => a.status === s).length;
      expect(count("assigned")).toBe(1);
      expect(count("overdue")).toBe(1);
      expect(count("in_progress")).toBe(1);
      expect(count("quality_review")).toBe(1);
      expect(count("returned")).toBe(1);
      expect(count("closed")).toBe(1);
      const closed = (await call("qm", "GET", `/raqib/actions/${all.find((a) => a.status === "closed")!.id}`)).body;
      expect(closed.log.map((l: Json) => l.kind)).toEqual(["created", "started", "submitted", "closed"]);
      expect(closed.log.at(-1).actor.title.en).toBe("Director of Quality");
      expect(closed.evidence).toHaveLength(1);
    });

    it("scopes actions by project", async () => {
      expect((await actions("pm")).every((a) => a.project.code === "PRJ-RYD-014")).toBe(true);
      expect((await actions("sultan")).every((a) => a.project.code === "PRJ-JED-007")).toBe(true);
      const mine = (await actions("sultan"))[0]!;
      expect((await call("pm", "GET", `/raqib/actions/${mine.id}`)).status).toBe(403);
      expect((await call("insA", "GET", "/raqib/actions")).status).toBe(403);
    });
  });

  describe("the workflow", () => {
    it("creates an action only for an eligible person, a future date, once per observation", async () => {
      const open = (await observations()).filter((o) => !o.action && o.project.code === "PRJ-RYD-014")[0]!;
      const pm = (await call("qm", "GET", `/raqib/actions/responsible?projectId=${open.project.id}`)).body.items as Json[];
      expect(pm.map((p) => p.name.en)).toContain("Fahad Al-Dosari");
      const base = { responsibleId: pm.find((p) => p.name.en === "Fahad Al-Dosari")!.id, dueDate: "2026-10-12", priority: "medium", description: "Fix it." };
      expect((await call("pm", "POST", `/raqib/observations/${open.id}/action`, base)).status).toBe(403); // pm cannot assign
      expect((await call("qm", "POST", `/raqib/observations/${open.id}/action`, { ...base, dueDate: "2026-09-01" })).status).toBe(400);
      const inspectorId = (await call("qm", "GET", "/raqib/users")).body.items.find((u: Json) => u.role === "ins").id;
      expect((await call("qm", "POST", `/raqib/observations/${open.id}/action`, { ...base, responsibleId: inspectorId })).body.error.code).toBe("raqib.invalid_responsible");
      const ok = await call("qm", "POST", `/raqib/observations/${open.id}/action`, base);
      expect(ok.status).toBe(201);
      expect(ok.body.ref).toMatch(/^CA-26-\d{4}$/);
      expect((await call("qm", "POST", `/raqib/observations/${open.id}/action`, base)).body.error.code).toBe("raqib.action_exists");
      expect((await notifications("pm")).some((n) => n.type === "raqib.action_assigned")).toBe(true);
    });

    it("only the responsible person works the action; quality reviews; the approve right closes; nobody reviews their own", async () => {
      const a = (await byStatus("assigned"))[0]!;
      expect((await call("qm", "POST", `/raqib/actions/${a.id}/start`)).status).toBe(403); // no S right
      expect((await call("sultan", "POST", `/raqib/actions/${a.id}/start`)).status).toBe(403); // wrong project
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/submit`)).body.error.code).toBe("raqib.invalid_transition");
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/start`)).body.status).toBe("in_progress");
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/submit`)).body.error.code).toBe("raqib.evidence_required");
      // closure evidence: private, linked through the action, only by the responsible person
      const file = await upload("pm");
      expect((await call("qm", "POST", "/raqib/evidence", { fileId: file, actionId: a.id })).status).toBe(403);
      const ev = await call("pm", "POST", "/raqib/evidence", { fileId: file, actionId: a.id });
      expect(ev.status).toBe(201);
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/submit`)).body.status).toBe("quality_review");
      expect((await notifications("qm")).some((n) => n.type === "raqib.action_submitted")).toBe(true);
      // evidence is frozen once handed over, and readable only inside scope
      expect((await call("pm", "DELETE" as never, `/raqib/evidence/${ev.body.id}`)).status).toBe(409);
      const raw = await http.inject({ method: "GET", url: `/api/raqib/evidence/${ev.body.id}/content`, headers: { authorization: `Bearer ${tokens.qe}` } });
      expect(raw.statusCode).toBe(200);
      const denied = await http.inject({ method: "GET", url: `/api/raqib/evidence/${ev.body.id}/content`, headers: { authorization: `Bearer ${tokens.sultan}` } });
      expect(denied.statusCode).toBe(403);
      // review
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/close`, {})).status).toBe(403); // no P
      expect((await call("qe", "POST", `/raqib/actions/${a.id}/close`, {})).status).toBe(403); // review right only
      expect((await call("qe", "POST", `/raqib/actions/${a.id}/return`, { reason: "no" })).status).toBe(400);
      const returned = await call("qe", "POST", `/raqib/actions/${a.id}/return`, { reason: "Photo does not show the repaired camera." });
      expect(returned.body.status).toBe("returned");
      expect((await notifications("pm")).some((n) => n.type === "raqib.action_returned")).toBe(true);
      // second round
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/start`)).body.round).toBe(2);
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/submit`)).body.error.code).toBe("raqib.evidence_required"); // old evidence does not count
      await call("pm", "POST", "/raqib/evidence", { fileId: await upload("pm"), actionId: a.id });
      await call("pm", "POST", `/raqib/actions/${a.id}/submit`);
      const closed = await call("qm", "POST", `/raqib/actions/${a.id}/close`, { comment: "Verified on site." });
      expect(closed.body.status).toBe("closed");
      expect(closed.body.log.map((l: Json) => l.kind)).toEqual(["created", "started", "submitted", "returned", "started", "submitted", "closed"]);
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/start`)).body.error.code).toBe("raqib.invalid_transition");
      expect((await notifications("pm")).some((n) => n.type === "raqib.action_closed")).toBe(true);
    });

    it("keeps comments in the log, in scope only", async () => {
      const a = (await actions("sultan"))[0]!;
      const r = await call("sultan", "POST", `/raqib/actions/${a.id}/comments`, { text: "Waiting for the shift lead to sign." });
      expect(r.status).toBe(201);
      expect(r.body.log.at(-1)).toMatchObject({ kind: "comment", text: "Waiting for the shift lead to sign." });
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/comments`, { text: "hello" })).status).toBe(403);
    });

    it("the action history is immutable", async () => {
      await expect(ownerQuery(`UPDATE raqib_action_events SET text = 'changed'`)).rejects.toThrow(/immutable/);
    });
  });

  describe("overdue", () => {
    it("announces overdue actions once, to the responsible person and quality", async () => {
      const first = await runner.tick();
      expect(first?.actionsMarkedOverdue).toBeGreaterThanOrEqual(1);
      expect((await runner.tick())?.actionsMarkedOverdue).toBe(0);
      expect((await notifications("pm")).filter((n) => n.type === "raqib.action_overdue").length).toBe(1);
      expect((await notifications("qm")).some((n) => n.type === "raqib.action_overdue")).toBe(true);
    });
  });
});
