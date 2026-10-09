/**
 * The Administrative Staff role: keeps the schedule inside its assigned projects and prints reports, and nothing
 * more — no inspections, review, approval, scores, analytics, users or settings.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib administrative staff", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "adm", "insA"]) tokens[key] = await loginAs(http, email(key));
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  it("is a known role with a project scope and a narrow template", async () => {
    const me = (await call("adm", "GET", "/raqib/me")).body;
    expect(me.role).toBe("adm");
    expect(me.scope).toHaveLength(2);
    expect(me.permissions.visits).toBe("VAEDX");
    expect(me.permissions.inspections).toBe("");
    expect(me.permissions.analytics).toBe("");
  });

  it("reads the schedule only inside its own projects, without scores", async () => {
    const mine = (await call("adm", "GET", "/raqib/visits")).body.items as Json[];
    const all = (await call("qm", "GET", "/raqib/visits")).body.items as Json[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(all.length);
    const allowed = new Set((await call("adm", "GET", "/raqib/me")).body.scope as string[]);
    expect(mine.every((v) => allowed.has(v.project.id))).toBe(true);
    expect(mine.some((v) => v.scorePct != null)).toBe(false);
    expect(all.some((v) => v.scorePct != null)).toBe(true);
  });

  it("cannot reach inspection, review, scoring, analytics, users or settings", async () => {
    const visit = ((await call("adm", "GET", "/raqib/visits")).body.items as Json[])[0]!;
    expect((await call("adm", "POST", `/raqib/visits/${visit.id}/inspection/start`)).status).toBe(403);
    expect((await call("adm", "GET", "/raqib/analytics")).status).toBe(403);
    expect((await call("adm", "GET", "/raqib/users")).status).toBe(403);
    expect((await call("adm", "GET", "/raqib/settings")).status).toBe(403);
    expect((await call("adm", "GET", "/raqib/scoring")).status).toBe(403);
    expect((await call("adm", "GET", "/raqib/audit")).status).toBe(403);
    expect((await call("adm", "GET", "/raqib/reports")).status).toBe(403);
  });

  it("cannot open a visit of a project outside its scope", async () => {
    const scope = new Set((await call("adm", "GET", "/raqib/me")).body.scope as string[]);
    const outside = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => !scope.has(v.project.id))!;
    expect(outside).toBeDefined();
    expect([403, 404]).toContain((await call("adm", "GET", `/raqib/visits/${outside.id}`)).status);
  });
});
