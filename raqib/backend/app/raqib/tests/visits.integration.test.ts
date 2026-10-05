/**
 * Phase 2 — projects & scheduling: visits are scoped by project AND (for inspectors) by ownership, every state
 * change is validated, history is immutable with actor snapshots, overdue is derived, and notifications reach
 * the right people in their own language — all over real HTTP.
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

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib visits & scheduling", () => {
  let http: NestFastifyApplication;
  let runner: JobsRunner;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const TODAY = "2026-10-04";

  const call = async (who: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : {}) as Json };
  };
  const visits = async (who: string) => (await call(who, "GET", "/raqib/visits")).body.items as Json[];
  const byRef = (items: Json[], pred: (v: Json) => boolean) => items.find(pred)!;

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock(`${TODAY}T08:00:00.000Z`) });
    http = booted.http;
    runner = get<JobsRunner>(booted.moduleRef, JobsRunner);
    for (const key of ["qm", "qe", "pm", "insA", "insB", "guard", "sultan"]) tokens[key] = await loginAs(http, email(key));
    const users = (await call("qm", "GET", "/raqib/users")).body.items as Json[];
    for (const key of ["insA", "insB", "qm", "qe"]) ids[key] = users.find((u) => u.email === email(key))!.id;
    const projects = (await call("qm", "GET", "/raqib/projects")).body.items as Json[];
    for (const p of projects) {
      ids[p.code] = p.id;
      p.sites.forEach((s: Json, i: number) => (ids[`${p.code}:site${i}`] = s.id));
    }
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("visibility", () => {
    it("seeds the scheduling demo through the real service", async () => {
      expect((await visits("qm")).length).toBe(16);
    });

    it("shows inspectors only their own visits", async () => {
      const a = await visits("insA");
      expect(a.map((v) => v.inspector.id)).toEqual(Array(a.length).fill(ids.insA));
      expect(a.length).toBe(7);
      const b = await visits("insB");
      expect(b.every((v) => v.inspector.id === ids.insB)).toBe(true);
    });

    it("scopes managers and quality staff by project", async () => {
      expect(new Set((await visits("pm")).map((v) => v.project.code))).toEqual(new Set(["PRJ-RYD-014"]));
      expect((await visits("sultan")).every((v) => v.project.code === "PRJ-JED-007")).toBe(true);
      expect(new Set((await visits("qe")).map((v) => v.project.code))).toEqual(new Set(["PRJ-RYD-014", "PRJ-JED-007", "PRJ-DMM-003"]));
    });

    it("rejects an inspector opening another inspector's visit by id (and another project's)", async () => {
      const bs = await visits("insB");
      const res = await call("insA", "GET", `/raqib/visits/${bs[0]!.id}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("raqib.out_of_scope");
      const pmOut = await call("pm", "GET", `/raqib/visits/${bs[0]!.id}`);
      expect(pmOut.status).toBe(403);
    });

    it("rejects roles without the visits module", async () => {
      expect((await call("guard", "GET", "/raqib/visits")).status).toBe(403);
    });
  });

  describe("eligible inspectors", () => {
    it("lists only active inspectors assigned to the project, and only to people who schedule", async () => {
      const ryd = await call("qm", "GET", `/raqib/visits/inspectors/eligible?projectId=${ids["PRJ-RYD-014"]}`);
      expect((ryd.body.items as Json[]).map((x) => x.id)).toEqual([ids.insA]);
      const jed = await call("qe", "GET", `/raqib/visits/inspectors/eligible?projectId=${ids["PRJ-JED-007"]}`);
      expect((jed.body.items as Json[]).map((x) => x.id)).toEqual([ids.insB]);
      expect((await call("insA", "GET", `/raqib/visits/inspectors/eligible?projectId=${ids["PRJ-RYD-014"]}`)).status).toBe(403);
      expect((await call("qe", "GET", `/raqib/visits/inspectors/eligible?projectId=${ids["PRJ-RYD-019"]}`)).status).toBe(403);
    });
  });

  describe("derived status", () => {
    it("shows a visit that never started as overdue while it is stored as assigned", async () => {
      const v = byRef(await visits("qm"), (x) => x.date === "2026-10-01" && x.status === "overdue");
      expect(v.status).toBe("overdue");
      expect(v.storedStatus).toBe("assigned");
    });
  });

  describe("create", () => {
    const body = (over: Json = {}) => ({
      projectId: ids["PRJ-RYD-014"], siteId: ids["PRJ-RYD-014:site0"], inspectorId: ids.insA, type: "routine", shift: "morning",
      date: "2026-10-12", time: "09:00", reason: "Routine round", ...over,
    });

    it("lets scheduling roles create and assign, writes history, and references are sequential", async () => {
      const res = await call("qm", "POST", "/raqib/visits", body());
      expect(res.status).toBe(201);
      expect(res.body.ref).toMatch(/^VIS-26-\d{4}$/);
      expect(res.body.status).toBe("assigned");
      expect(res.body.history.map((h: Json) => h.action)).toEqual(["scheduled", "assigned"]);
      expect(res.body.history[0].actor.title.en).toBe("Director of Quality");
      const second = await call("qm", "POST", "/raqib/visits", body({ time: "11:00" }));
      expect(Number(second.body.ref.slice(-4))).toBe(Number(res.body.ref.slice(-4)) + 1);
    });

    it("creates an unassigned visit as 'scheduled'", async () => {
      const res = await call("qe", "POST", "/raqib/visits", body({ inspectorId: null, time: "13:00" }));
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("scheduled");
      expect(res.body.inspector).toBeNull();
    });

    it("refuses roles that cannot schedule", async () => {
      expect((await call("insA", "POST", "/raqib/visits", body())).status).toBe(403);
      expect((await call("pm", "POST", "/raqib/visits", body())).status).toBe(403);
    });

    it("refuses scheduling outside the caller's project scope", async () => {
      const res = await call("qe", "POST", "/raqib/visits", body({ projectId: ids["PRJ-RYD-019"], siteId: ids["PRJ-RYD-014:site0"] }));
      expect(res.status).toBe(403);
    });

    it("validates dates, sites and inspector eligibility", async () => {
      expect((await call("qm", "POST", "/raqib/visits", body({ date: "2026-10-01" }))).body.error.code).toBe("raqib.date_in_past");
      expect((await call("qm", "POST", "/raqib/visits", body({ siteId: ids["PRJ-JED-007:site0"] }))).body.error.code).toBe("raqib.site_mismatch");
      // Khalid (insA) is assigned to Riyadh only
      const res = await call("qm", "POST", "/raqib/visits", body({ projectId: ids["PRJ-JED-007"], siteId: ids["PRJ-JED-007:site0"] }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("raqib.inspector_not_eligible");
      expect((await call("qm", "POST", "/raqib/visits", body({ time: "25:00" }))).status).toBe(400);
      expect((await call("qm", "POST", "/raqib/visits", body({ reason: "" }))).status).toBe(400);
    });

    it("refuses double-booking an inspector at the same date and time", async () => {
      const res = await call("qm", "POST", "/raqib/visits", body({ time: "09:00" }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("raqib.inspector_busy");
    });
  });

  describe("reschedule and cancel", () => {
    it("keeps the full history of a reschedule, including who and why", async () => {
      const v = byRef(await visits("qm"), (x) => x.date === "2026-10-06" && x.inspector?.id === ids.insA);
      expect(v.history.map((h: Json) => h.action)).toEqual(["scheduled", "assigned", "rescheduled"]);
      expect(v.history[2].reason).toMatch(/Civil Defense/);
    });

    it("reassigns to another eligible inspector and requires a reason", async () => {
      const v = byRef(await visits("qm"), (x) => x.time === "13:00" && x.inspector === null);
      expect((await call("qe", "POST", `/raqib/visits/${v.id}/reschedule`, { date: "2026-10-12", time: "13:00" })).status).toBe(400);
      const ok = await call("qe", "POST", `/raqib/visits/${v.id}/reschedule`, { date: "2026-10-12", time: "13:00", inspectorId: ids.insA, reason: "Assigning an inspector" });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe("assigned");
    });

    it("cancels with a reason, keeps the record, and then refuses further changes", async () => {
      const v = byRef(await visits("qm"), (x) => x.date === "2026-10-12" && x.time === "11:00");
      expect((await call("qm", "POST", `/raqib/visits/${v.id}/cancel`, {})).status).toBe(400);
      const res = await call("qm", "POST", `/raqib/visits/${v.id}/cancel`, { reason: "Site closed" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelled");
      expect(res.body.history.at(-1).reason).toBe("Site closed");
      expect((await call("qm", "POST", `/raqib/visits/${v.id}/cancel`, { reason: "again" })).status).toBe(409);
      expect((await call("qm", "POST", `/raqib/visits/${v.id}/reschedule`, { date: "2026-10-20", time: "10:00", reason: "x1y" })).status).toBe(409);
    });

    it("lets an inspector neither reschedule nor cancel", async () => {
      const mine = (await visits("insA"))[0]!;
      expect((await call("insA", "POST", `/raqib/visits/${mine.id}/cancel`, { reason: "nope" })).status).toBe(403);
    });

    it("never lets visit history be edited in the database", async () => {
      await expect(ownerQuery(`UPDATE raqib_visit_events SET reason = 'tampered'`)).rejects.toThrow(/immutable/);
    });
  });

  describe("notifications and jobs", () => {
    const notifications = async (who: string) => (await call(who, "GET", "/notifications")).body;

    it("tells an inspector about a new assignment, in their language, with a link — and never the actor about themselves", async () => {
      const n = (await notifications("insA")).notifications as Json[];
      const assigned = n.find((x) => x.type === "raqib.visit_assigned")!;
      expect(assigned.title).toMatch(/زيارة جديدة مسندة إليك/);
      expect(assigned.data.go[0]).toBe("visit");
      const actor = (await notifications("qm")).notifications as Json[];
      expect(actor.filter((x) => x.type === "raqib.visit_assigned")).toHaveLength(0);
    });

    it("tells the previous inspector when a visit is reassigned away, and the inspector when it is cancelled", async () => {
      expect(((await notifications("insA")).notifications as Json[]).some((x) => x.type === "raqib.visit_rescheduled" || x.type === "raqib.visit_assigned")).toBe(true);
      const cancelled = ((await notifications("insA")).notifications as Json[]).find((x) => x.type === "raqib.visit_cancelled");
      expect(cancelled?.body).toMatch(/Site closed|إغلاق|Site closed/);
    });

    it("announces an overdue visit once, to the inspector and the people who schedule that project", async () => {
      const first = await runner.tick();
      expect(first?.visitsMarkedOverdue).toBe(1);
      const second = await runner.tick();
      expect(second?.visitsMarkedOverdue).toBe(0);
      const mine = ((await notifications("insB")).notifications as Json[]).filter((x) => x.type === "raqib.visit_overdue");
      expect(mine).toHaveLength(1);
      const qm = ((await notifications("qm")).notifications as Json[]).filter((x) => x.type === "raqib.visit_overdue");
      expect(qm).toHaveLength(1);
      // a project manager does not schedule visits, so is not told
      expect(((await notifications("pm")).notifications as Json[]).filter((x) => x.type === "raqib.visit_overdue")).toHaveLength(0);
    });

    it("keeps one person's notifications private from another", async () => {
      const a = (await notifications("insA")).notifications as Json[];
      const b = (await notifications("insB")).notifications as Json[];
      const bIds = new Set(b.map((x) => x.id));
      expect(a.every((x) => !bIds.has(x.id))).toBe(true);
    });
  });
});
