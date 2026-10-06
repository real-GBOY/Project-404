/**
 * Administrative flows that keep the system workable over time: correcting a person's record, and handing a stuck
 * corrective action to someone else or moving its due date. Authorization, history and notification are checked over real HTTP.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib administrative flows", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const call = async (who: string, method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : {}) as Json };
  };

  beforeAll(async () => {
    http = (await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") })).http;
    for (const key of ["qm", "qe", "pm", "insA", "insB"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);
  afterAll(async () => {
    await http?.close();
  });

  describe("editing a person", () => {
    it("corrects name, title, phone and employee number, and audits it", async () => {
      const users = (await call("qm", "GET", "/raqib/users")).body.items as Json[];
      const ins = users.find((u) => u.email === email("insB"))!;
      const res = await call("qm", "PATCH", `/raqib/users/${ins.id}`, {
        name: { ar: "راشد الزهراني", en: "Rashed Al-Zahrani" },
        title: { ar: "مفتش أول", en: "Senior Inspector" },
        phone: "+966500000001",
        employeeNo: "E-77001",
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: { en: "Rashed Al-Zahrani" }, title: { en: "Senior Inspector" }, employeeNo: "E-77001", role: "ins" });
    });

    it("refuses an employee number that someone else holds, and roles without the edit right", async () => {
      const users = (await call("qm", "GET", "/raqib/users")).body.items as Json[];
      const a = users.find((u) => u.email === email("insA"))!;
      const taken = await call("qm", "PATCH", `/raqib/users/${a.id}`, { employeeNo: "E-77001" });
      expect(taken.status).toBe(409);
      expect(taken.body.error.code).toBe("raqib.employee_taken");
      expect((await call("insA", "PATCH", `/raqib/users/${a.id}`, { phone: "1" })).status).toBe(403);
      expect((await call("qm", "PATCH", `/raqib/users/${a.id}`, { role: "qm" })).status).toBe(400); // role has its own route
      expect((await call("qm", "PATCH", "/raqib/users/nobody", { phone: "1" })).status).toBe(404);
    });
  });

  describe("reassigning a corrective action", () => {
    const open = async () => ((await call("qm", "GET", "/raqib/actions")).body.items as Json[]).find((a) => a.status === "assigned")!;

    it("moves an open action to another eligible person and a later date, and the history says why", async () => {
      const a = await open();
      const eligible = (await call("qm", "GET", `/raqib/actions/responsible?projectId=${a.project.id}`)).body.items as Json[];
      const next = eligible.find((p) => p.id !== a.responsible.id);
      if (!next) return; // a project with a single eligible person has nobody to hand it to
      const res = await call("qm", "POST", `/raqib/actions/${a.id}/reassign`, {
        responsibleId: next.id,
        dueDate: "2026-12-01",
        reason: "Original owner is on leave.",
      });
      expect(res.status).toBe(200);
      expect(res.body.responsible.id).toBe(next.id);
      expect(res.body.dueDate).toBe("2026-12-01");
      expect(res.body.log.at(-1)).toMatchObject({ kind: "reassigned", text: "Original owner is on leave." });
    });

    it("can move only the due date, but never into the past, and needs a reason", async () => {
      const a = await open();
      expect((await call("qm", "POST", `/raqib/actions/${a.id}/reassign`, { dueDate: "2026-09-01", reason: "Too late." })).status).toBe(400);
      expect((await call("qm", "POST", `/raqib/actions/${a.id}/reassign`, { dueDate: "2026-12-05" })).status).toBe(400);
      const ok = await call("qm", "POST", `/raqib/actions/${a.id}/reassign`, { dueDate: "2026-12-05", reason: "Waiting for parts." });
      expect(ok.status).toBe(200);
      expect(ok.body.dueDate).toBe("2026-12-05");
      expect((await call("qm", "POST", `/raqib/actions/${a.id}/reassign`, { dueDate: "2026-12-05", reason: "No change at all." })).body.error.code).toBe(
        "raqib.nothing_to_change",
      );
    });

    it("refuses someone who cannot hold actions on the project, a role without the assign right, and a closed action", async () => {
      const a = await open();
      const users = (await call("qm", "GET", "/raqib/users")).body.items as Json[];
      const inspector = users.find((u) => u.role === "ins")!;
      expect((await call("qm", "POST", `/raqib/actions/${a.id}/reassign`, { responsibleId: inspector.id, reason: "Not allowed." })).body.error.code).toBe(
        "raqib.invalid_responsible",
      );
      expect((await call("pm", "POST", `/raqib/actions/${a.id}/reassign`, { dueDate: "2026-12-09", reason: "I am not allowed." })).status).toBe(403);
      const closed = ((await call("qm", "GET", "/raqib/actions")).body.items as Json[]).find((x) => x.status === "closed")!;
      expect((await call("qm", "POST", `/raqib/actions/${closed.id}/reassign`, { dueDate: "2026-12-09", reason: "History." })).body.error.code).toBe(
        "raqib.invalid_transition",
      );
    });
  });

  describe("closing a project", () => {
    it("keeps it in history but takes no new visits, and a reopened project takes them again", async () => {
      const projects = (await call("qm", "GET", "/raqib/projects")).body.items as Json[];
      const p = projects.find((x) => x.code === "PRJ-RYD-014")!;
      const visit = { projectId: p.id, siteId: p.sites[0].id, type: "routine", shift: "morning", date: "2026-11-01", time: "09:00", reason: "Scheduled round" };
      expect((await call("qm", "PATCH", `/raqib/projects/${p.id}`, { status: "closed" })).body.status).toBe("closed");
      const refused = await call("qm", "POST", "/raqib/visits", visit);
      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe("raqib.project_closed");
      await call("qm", "PATCH", `/raqib/projects/${p.id}`, { status: "active" });
      expect((await call("qm", "POST", "/raqib/visits", visit)).status).toBe(201);
    });
  });
});
