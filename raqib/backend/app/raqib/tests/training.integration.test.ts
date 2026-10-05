/**
 * Phase 6b — training requests and the guard record: the supervisor asks, the manager decides, quality runs the
 * training; separate rights, project scope, immutable history, and the guard's evaluations come from issued reports.
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

async function ownerQuery(text: string) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text)).rows;
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasTestDb)("Raqib training requests", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const call = async (who: string, method: "GET" | "POST", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json };
  };
  const list = async (who = "qm") => (await call(who, "GET", "/raqib/training")).body.items as Json[];
  const guards = async () => (await call("qm", "GET", "/raqib/guards")).body.items as Json[];

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "sultan", "gs", "insA"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  it("seeds a request in every state", async () => {
    const all = await list();
    const count = (s: string) => all.filter((t) => t.status === s).length;
    for (const s of ["pending_pm", "returned", "approved", "scheduled", "completed", "rejected"]) expect(count(s)).toBe(1);
    const done = all.find((t) => t.status === "completed")!;
    const full = (await call("qm", "GET", `/raqib/training/${done.id}`)).body;
    expect(full.log.map((l: Json) => l.kind)).toEqual(["requested", "approved", "scheduled", "completed"]);
    expect(full.result).toBe("passed");
  });

  it("is scoped by project and permission", async () => {
    expect((await list("sultan")).length).toBe(0); // Jeddah has none
    expect((await list("pm")).length).toBe(6);
    expect((await call("insA", "GET", "/raqib/training")).status).toBe(403);
  });

  it("the supervisor asks; the manager decides; nobody decides their own", async () => {
    const g = (await guards()).find((x) => x.employeeNo === "G-10251")!;
    const body = { guardId: g.id, reason: "incident", course: "Radio discipline", related: "", priority: "medium", notes: "Heard on the net." };
    expect((await call("pm", "POST", "/raqib/training", body)).status).toBe(403); // the manager has no A
    const jed = (await guards()).find((x) => x.employeeNo === "G-20117")!;
    expect((await call("gs", "POST", "/raqib/training", { ...body, guardId: jed.id })).status).toBe(403); // out of the supervisor's scope
    const created = await call("gs", "POST", "/raqib/training", body);
    expect(created.status).toBe(201);
    expect(created.body.ref).toMatch(/^TR-26-\d{4}$/);
    const id = created.body.id;
    expect((await call("gs", "POST", `/raqib/training/${id}/approve`, {})).status).toBe(403);
    expect((await call("sultan", "POST", `/raqib/training/${id}/approve`, {})).status).toBe(403); // other project
    expect((await call("pm", "POST", `/raqib/training/${id}/schedule`, { date: "2026-10-10", provider: "academy" })).status).toBe(403);
    expect((await call("pm", "POST", `/raqib/training/${id}/return`, { reason: "x" })).status).toBe(400);
    const returned = await call("pm", "POST", `/raqib/training/${id}/return`, { reason: "Say which incident." });
    expect(returned.body.status).toBe("returned");
    expect((await call("pm", "POST", `/raqib/training/${id}/resubmit`, { notes: "n" })).status).toBe(403); // not the requester
    const re = await call("gs", "POST", `/raqib/training/${id}/resubmit`, { notes: "Incident INC-114 on 28/9." });
    expect(re.body.status).toBe("pending_pm");
    expect(re.body.round).toBe(2);
    expect((await call("pm", "POST", `/raqib/training/${id}/approve`, {})).body.status).toBe("approved");
    expect((await call("pm", "POST", `/raqib/training/${id}/approve`, {})).body.error.code).toBe("raqib.invalid_transition");
    // quality runs it
    expect((await call("qe", "POST", `/raqib/training/${id}/schedule`, { date: "2026-09-01", provider: "academy" })).status).toBe(400);
    expect((await call("qe", "POST", `/raqib/training/${id}/schedule`, { date: "2026-10-09", provider: "academy" })).body.status).toBe("scheduled");
    expect((await call("qe", "POST", `/raqib/training/${id}/complete`, { date: "2026-10-20", result: "passed" })).status).toBe(400); // future
    const done = await call("qe", "POST", `/raqib/training/${id}/complete`, { date: "2026-10-03", result: "attended", note: "Present throughout." });
    expect(done.body.status).toBe("completed");
    expect((await call("qe", "POST", `/raqib/training/${id}/complete`, { date: "2026-10-03", result: "passed" })).body.error.code).toBe("raqib.invalid_transition");
    // notifications
    const n = (await call("gs", "GET", "/notifications")).body.notifications as Json[];
    expect(n.map((x) => x.type)).toEqual(expect.arrayContaining(["raqib.training_returned", "raqib.training_approved", "raqib.training_scheduled", "raqib.training_completed"]));
    expect(((await call("pm", "GET", "/notifications")).body.notifications as Json[]).some((x) => x.type === "raqib.training_requested")).toBe(true);
  });

  it("the history is immutable", async () => {
    await expect(ownerQuery(`UPDATE raqib_training_events SET text = 'x'`)).rejects.toThrow(/immutable/);
  });

  it("a guard's record shows evaluations from issued reports and their training", async () => {
    const g = (await guards()).find((x) => x.employeeNo === "G-10288")!;
    const h = (await call("gs", "GET", `/raqib/guards/${g.id}/history`)).body;
    expect(h.guard.employeeNo).toBe("G-10288");
    expect(h.evaluations.length).toBeGreaterThanOrEqual(1);
    expect(h.evaluations[0].reportRef).toMatch(/^RPT-/);
    expect(h.training.length).toBeGreaterThanOrEqual(2);
    const jed = (await guards()).find((x) => x.employeeNo === "G-20117")!;
    expect((await call("gs", "GET", `/raqib/guards/${jed.id}/history`)).status).toBe(403);
  });
});
