/**
 * Requirement 16: a supervisor's request goes to the project manager and then to Quality Management; a guard's request is
 * reviewed by a supervisor first, then the project manager, then Quality Management. The chain is configurable, nothing can be
 * skipped, nobody decides their own request, and every step, reason and time is kept.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib training approval chains", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  let other: Json; // another guard of the same project
  const body = { reason: "refresher", course: "First aid refresher", related: "", priority: "medium", notes: "Certificate expires soon." };

  const call = async (who: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json };
  };
  const guards = async () => (await call("qm", "GET", "/raqib/guards")).body.items as Json[];
  const setChain = async (guardReviewBySupervisor: boolean) => {
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    return call("qm", "PUT", "/raqib/settings", { settings: { ...cur, training: { guardReviewBySupervisor } }, reason: "training chain (test)" });
  };
  const notifications = async (who: string, type: string) =>
    ((await call(who, "GET", "/notifications")).body.notifications as Json[]).filter((n) => n.type === type);

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "gs", "guard", "insA"]) tokens[key] = await loginAs(http, email(key));
    other = (await guards()).find((g) => g.employeeNo === "G-10251")!;
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("a guard's request: supervisor, project manager, quality", () => {
    let id = "";

    it("is asked by the guard for themselves, and lands with a supervisor", async () => {
      // naming somebody else is ignored: a guard can only ask for their own record
      const made = await call("guard", "POST", "/raqib/training", { ...body, guardId: other.id });
      expect(made.status).toBe(201);
      id = made.body.id;
      expect(made.body).toMatchObject({ status: "pending_supervisor", requesterKind: "guard" });
      expect(made.body.guard.employeeNo).toBe("G-10302");
      expect(made.body.project.code).toBe("PRJ-RYD-014"); // filled in from the roster
      expect((await notifications("gs", "raqib.training_requested")).some((n) => n.data.go[1] === id)).toBe(true);
      expect((await notifications("pm", "raqib.training_requested")).some((n) => n.data.go[1] === id)).toBe(false); // not yet
    });

    it("a guard sees only their own requests", async () => {
      const mine = (await call("guard", "GET", "/raqib/training")).body.items as Json[];
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((t) => t.guard.employeeNo === "G-10302")).toBe(true);
      const someoneElses = ((await call("qm", "GET", "/raqib/training")).body.items as Json[]).find((t) => t.guard.employeeNo !== "G-10302")!;
      expect((await call("guard", "GET", `/raqib/training/${someoneElses.id}`)).status).toBe(403);
      expect((await call("insA", "POST", "/raqib/training", { ...body, guardId: other.id })).status).toBe(403);
    });

    it("cannot skip a stage, and only the right role acts at each one", async () => {
      expect((await call("pm", "POST", `/raqib/training/${id}/approve`, {})).body.error.code).toBe("raqib.invalid_transition"); // the supervisor comes first
      expect((await call("guard", "POST", `/raqib/training/${id}/review`, {})).status).toBe(403); // not their own
      expect((await call("qm", "POST", `/raqib/training/${id}/review`, {})).status).toBe(403); // quality is not the supervisor
      expect((await call("pm", "POST", `/raqib/training/${id}/review`, {})).status).toBe(403);
      expect((await call("gs", "POST", `/raqib/training/${id}/approve`, {})).status).toBe(403); // a supervisor does not approve
      expect((await call("qm", "POST", `/raqib/training/${id}/schedule`, { date: "2026-11-01", provider: "internal" })).status).toBe(409);
    });

    it("a supervisor returns it with a reason; the guard resubmits and it goes back to the supervisor", async () => {
      expect((await call("gs", "POST", `/raqib/training/${id}/return`, {})).status).toBe(400); // a reason is required
      const returned = await call("gs", "POST", `/raqib/training/${id}/return`, { reason: "Add the certificate number." });
      expect(returned.body.status).toBe("returned");
      const again = await call("guard", "POST", `/raqib/training/${id}/resubmit`, { notes: "Certificate FA-2291." });
      expect(again.body).toMatchObject({ status: "pending_supervisor", round: 2 });
    });

    it("the supervisor forwards it, the project manager approves it, quality schedules and completes it, with every step recorded", async () => {
      const reviewed = await call("gs", "POST", `/raqib/training/${id}/review`, { comment: "Confirmed with the shift lead." });
      expect(reviewed.body.status).toBe("pending_pm");
      expect((await notifications("pm", "raqib.training_requested")).some((n) => n.data.go[1] === id)).toBe(true);
      expect((await call("pm", "POST", `/raqib/training/${id}/approve`, {})).body.status).toBe("approved");
      expect((await notifications("qm", "raqib.training_approved")).some((n) => n.data.go[1] === id)).toBe(true); // submitted to Quality Management
      expect((await call("qm", "POST", `/raqib/training/${id}/schedule`, { date: "2026-11-01", provider: "academy" })).body.status).toBe("scheduled");
      const done = await call("qm", "POST", `/raqib/training/${id}/complete`, { date: "2026-10-04", result: "passed", note: "Passed." });
      expect(done.body.status).toBe("completed");
      const log = (await call("qm", "GET", `/raqib/training/${id}`)).body.log as Json[];
      expect(log.map((l) => l.kind)).toEqual(["requested", "returned", "resubmitted", "reviewed", "approved", "scheduled", "completed"]);
      expect(log[1]).toMatchObject({ text: "Add the certificate number.", actor: { role: "gs" } });
      expect(log.every((l) => l.at && l.actor.name.en)).toBe(true);
    });
  });

  describe("a supervisor's request: project manager, then quality", () => {
    it("starts with the project manager, who may reject it with a reason", async () => {
      const made = await call("gs", "POST", "/raqib/training", { ...body, guardId: other.id, course: "Radio discipline" });
      expect(made.body).toMatchObject({ status: "pending_pm", requesterKind: "supervisor" });
      const id = made.body.id as string;
      expect((await call("gs", "POST", `/raqib/training/${id}/approve`, {})).status).toBe(403); // nobody decides their own
      expect((await call("qm", "POST", `/raqib/training/${id}/approve`, {})).status).toBe(403); // quality does not approve at the manager's stage
      expect((await call("pm", "POST", `/raqib/training/${id}/reject`, {})).status).toBe(400);
      const rejected = await call("pm", "POST", `/raqib/training/${id}/reject`, { reason: "No budget this quarter." });
      expect(rejected.body.status).toBe("rejected");
      const log = (await call("qm", "GET", `/raqib/training/${id}`)).body.log as Json[];
      expect(log.at(-1)).toMatchObject({ kind: "rejected", text: "No budget this quarter." });
    });
  });

  describe("the chain is configuration", () => {
    it("with the supervisor review switched off, a guard's request goes straight to the project manager", async () => {
      expect((await setChain(false)).status).toBe(200);
      const made = await call("guard", "POST", "/raqib/training", { ...body, course: "Fire marshal basics" });
      expect(made.body.error ?? made.body.status).toBe("pending_pm");
      expect((await setChain(true)).status).toBe(200);
      const back = await call("guard", "POST", "/raqib/training", { ...body, course: "Fire marshal basics 2" });
      expect(back.body.status).toBe("pending_supervisor");
    });
  });
});
