/**
 * Requirement 19: the quality department inspects, oversees, verifies and follows up; operational corrective action stays
 * with the project manager and the operational team. This is about what people may DO in the application (permissions), which
 * is deliberately not the same thing as who reports to whom in the company.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib responsibility model", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "gm", "insA", "gs"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  it("corrective actions can only be given to the people who do the operational work, never to quality staff", async () => {
    const projectId = ((await call("qm", "GET", "/raqib/projects")).body.items as Json[]).find((p) => p.code === "PRJ-RYD-014")!.id;
    const eligible = (await call("qm", "GET", `/raqib/actions/responsible?projectId=${projectId}`)).body.items as Json[];
    const names = eligible.map((e) => e.name.en);
    expect(names).toContain("Fahad Al-Dosari"); // the project manager
    for (const quality of ["Noura Al-Qahtani", "Saud Al-Otaibi", "Khalid Al-Shehri", "Mansour Al-Sudairi"]) {
      expect(names.some((n) => n.includes(quality))).toBe(false);
    }
    const open = ((await call("qm", "GET", "/raqib/observations")).body.items as Json[]).find((o) => !o.action && o.project.id === projectId)!;
    const qeId = (await call("qe", "GET", "/raqib/me")).body.id;
    const refused = await call("qm", "POST", `/raqib/observations/${open.id}/action`, {
      responsibleId: qeId,
      dueDate: "2026-12-01",
      priority: "medium",
      description: "x",
    });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("raqib.invalid_responsible");
  });

  it("the project manager works the action; quality cannot do the work, and the manager cannot verify or close it", async () => {
    const action = ((await call("pm", "GET", "/raqib/actions")).body.items as Json[]).find(
      (a) => a.storedStatus === "assigned" || a.storedStatus === "returned",
    );
    if (!action) return; // the demo always has one; defensive only
    for (const who of ["qm", "qe"]) {
      expect((await call(who, "POST", `/raqib/actions/${action.id}/start`)).status).toBe(403);
      expect((await call(who, "POST", `/raqib/actions/${action.id}/submit`)).status).toBe(403);
    }
    expect((await call("pm", "POST", `/raqib/actions/${action.id}/close`, {})).status).toBe(403);
    expect((await call("pm", "POST", `/raqib/actions/${action.id}/return`, { reason: "my own work" })).status).toBe(403);
  });

  it("quality inspects and verifies; the project manager neither runs nor decides inspections", async () => {
    const pending = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.status === "pending_review")!;
    expect((await call("pm", "POST", `/raqib/visits/${pending.id}/review/forward`, {})).status).toBe(403);
    const awaiting = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.status === "pending_approval")!;
    expect((await call("pm", "POST", `/raqib/visits/${awaiting.id}/review/approve`, {})).status).toBe(403);
    expect((await call("insA", "POST", `/raqib/visits/${pending.id}/review/forward`, {})).status).toBe(403);
    expect((await call("pm", "POST", `/raqib/visits/${pending.id}/inspection/start`)).status).toBe(403); // the manager does not inspect
    const view = await call("pm", "GET", `/raqib/visits/${pending.id}/inspection`);
    expect(view.status).toBe(403); // and does not read an inspection before it is approved
  });

  it("organizational reporting lines do not appear as permissions: the quality director holds no operational right", async () => {
    const me = (await call("qm", "GET", "/raqib/me")).body;
    expect(me.permissions.actions).not.toContain("S"); // cannot do corrective work
    expect(me.permissions.inspections).toContain("P"); // can verify and approve
    expect(me.permissions.training).not.toContain("P"); // cannot approve at the project manager's stage
    const pm = (await call("pm", "GET", "/raqib/me")).body;
    expect(pm.permissions.actions).toContain("S");
    expect(pm.permissions.inspections).not.toMatch(/[RP]/);
  });
});
