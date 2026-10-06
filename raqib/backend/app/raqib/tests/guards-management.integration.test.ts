/**
 * Managing the guard roster over real HTTP: create, edit, take off the roster. The access template, project scope,
 * uniqueness, the guard-role link rule and the audit trail (which must never carry a national ID) are all enforced
 * by the server; the frontend is never trusted.
 */
import pg from "pg";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;

describe.skipIf(!hasTestDb)("Raqib guard roster management", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  let emptyProject = "";
  let otherProject = "";

  const call = async (who: string, method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as Record<string, any>) : {} };
  };
  const userIdOf = async (key: string) =>
    (await ownerQuery<{ user_id: string }>(`SELECT p.user_id FROM raqib_profiles p JOIN users u ON u.id = p.user_id WHERE u.email = $1`, [email(key)]))[0]!
      .user_id;
  const newGuard = (over: Record<string, unknown> = {}) => ({
    projectId: emptyProject,
    employeeNo: "G-90001",
    nationalId: "1098765432",
    name: { ar: "ماجد الحربي", en: "Majid Al-Harbi" },
    post: { ar: "البوابة الرئيسية", en: "Main gate" },
    shift: "evening",
    ...over,
  });

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "gs", "insA", "sultan"]) tokens[key] = await loginAs(http, email(key));
    const projects = (await call("qm", "GET", "/raqib/projects")).body.items as Array<{ id: string; code: string }>;
    emptyProject = projects.find((p) => p.code === "PRJ-RYD-019")!.id;
    otherProject = projects.find((p) => p.code === "PRJ-JED-007")!.id;
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  it("creates a guard, masks the national ID in the response and keeps it out of the audit trail", async () => {
    const res = await call("qm", "POST", "/raqib/guards", newGuard());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ employeeNo: "G-90001", projectId: emptyProject, shift: "evening", status: "active" });
    expect(res.body.nationalId).toMatch(/^\d{4}•••\d{3}$/);
    const audit = await ownerQuery<{ blob: string }>(
      `SELECT (coalesce("before"::text,'') || coalesce("after"::text,'') || coalesce(metadata::text,'')) AS blob FROM audit_logs WHERE action = 'raqib.guard.created'`,
    );
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((a) => a.blob.includes("1098765432"))).toBe(false);
    const listed = (await call("qm", "GET", "/raqib/guards")).body.items as Array<{ employeeNo: string }>;
    expect(listed.some((g) => g.employeeNo === "G-90001")).toBe(true);
  });

  it("rejects a duplicate employee number with a 409", async () => {
    const res = await call("qm", "POST", "/raqib/guards", newGuard());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("raqib.employee_taken");
  });

  it("validates the shape: a national ID is exactly ten digits", async () => {
    const res = await call("qm", "POST", "/raqib/guards", newGuard({ employeeNo: "G-90002", nationalId: "12ab" }));
    expect(res.status).toBe(400);
  });

  it("only links an account that belongs to the guard role, and only once", async () => {
    const wrongRole = await call("qm", "POST", "/raqib/guards", newGuard({ employeeNo: "G-90003", userId: await userIdOf("insA") }));
    expect(wrongRole.status).toBe(400);
    expect(wrongRole.body.error.code).toBe("raqib.invalid_account");
    const taken = await call("qm", "POST", "/raqib/guards", newGuard({ employeeNo: "G-90004", userId: await userIdOf("guard") }));
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("raqib.account_already_linked");
  });

  it("edits a guard (move, shift, post) and records what changed", async () => {
    const created = (await call("qm", "GET", "/raqib/guards")).body.items.find((g: any) => g.employeeNo === "G-90001");
    const res = await call("qm", "PATCH", `/raqib/guards/${created.id}`, { projectId: otherProject, shift: "night", post: { ar: "السور", en: "Perimeter" } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ projectId: otherProject, shift: "night", employeeNo: "G-90001" });
    expect(res.body.post).toMatchObject({ en: "Perimeter" });
    const updated = await ownerQuery<{ n: string }>(`SELECT count(*)::text AS n FROM audit_logs WHERE action = 'raqib.guard.updated' AND resource_id = $1`, [
      created.id,
    ]);
    expect(updated[0]!.n).toBe("1");
  });

  it("takes a guard off the roster and back on", async () => {
    const created = (await call("qm", "GET", "/raqib/guards")).body.items.find((g: any) => g.employeeNo === "G-90001");
    const off = await call("qm", "POST", `/raqib/guards/${created.id}/status`, { status: "inactive" });
    expect(off.status).toBe(200);
    expect(off.body.status).toBe("inactive");
    const on = await call("qm", "POST", `/raqib/guards/${created.id}/status`, { status: "active" });
    expect(on.body.status).toBe("active");
  });

  it("refuses roles without the project edit right, and projects outside the caller's scope", async () => {
    expect((await call("insA", "POST", "/raqib/guards", newGuard({ employeeNo: "G-90005" }))).status).toBe(403);
    // Sultan manages Jeddah only: he cannot put a guard on another project.
    const out = await call("sultan", "POST", "/raqib/guards", newGuard({ employeeNo: "G-90006", projectId: emptyProject }));
    expect(out.status).toBe(403);
  });

  it("answers 404 for a guard that does not exist", async () => {
    expect((await call("qm", "PATCH", "/raqib/guards/nope", { shift: "night" })).status).toBe(404);
  });
});
