/**
 * Phase 4 — the review workflow: review and approval are separate rights, every decision is one transaction with
 * an immutable, snapshotted record, returned inspections can only be fixed where the reviewer pointed, and nobody
 * reviews their own work. All over real HTTP.
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

describe.skipIf(!hasTestDb)("Raqib review workflow", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : {}) as Json };
  };
  const visits = async (who = "qm") => (await call(who, "GET", "/raqib/visits")).body.items as Json[];
  const find = async (pred: (v: Json) => boolean, who = "qm") => (await visits(who)).find(pred)!;
  const insp = async (who: string, id: string) => (await call(who, "GET", `/raqib/visits/${id}/inspection`)).body;
  const decide = (who: string, id: string, action: string, body: Json = {}) => call(who, "POST", `/raqib/visits/${id}/review/${action}`, body);
  const notifications = async (who: string) => (await call(who, "GET", "/notifications")).body.notifications as Json[];

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "insA", "insB", "gs", "guard"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("the demo has inspections in every state, produced by the real workflow", () => {
    it("seeds returned, pending review, pending approval, approved and rejected inspections", async () => {
      const all = await visits();
      const count = (s: string) => all.filter((v) => v.status === s).length;
      expect(count("returned")).toBe(1);
      expect(count("pending_review")).toBeGreaterThanOrEqual(2);
      expect(count("pending_approval")).toBe(1);
      expect(count("approved")).toBe(3);
      expect(count("rejected")).toBe(1);
      const approved = all.find((v) => v.status === "approved")!;
      expect(approved.history.map((h: Json) => h.action)).toEqual(["scheduled", "assigned", "started", "submitted", "reviewed", "approved"]);
      expect(approved.history.at(-1).actor.title.en).toBe("Director of Quality");
      expect(approved.scorePct).not.toBeNull();
    });

    it("shows each person only what their scope allows", async () => {
      expect((await visits("pm")).every((v) => v.project.code === "PRJ-RYD-014")).toBe(true);
      const b = await visits("insB");
      expect(b.every((v) => v.inspector.id === b[0]!.inspector.id)).toBe(true);
      // a project manager cannot open an inspection until it is approved/reported
      const pending = await find((v) => v.status === "pending_review" && v.project.code === "PRJ-RYD-014");
      expect((await call("pm", "GET", `/raqib/visits/${pending.id}/inspection`)).status).toBe(403);
    });
  });

  describe("authority", () => {
    it("lets only people with the right letter decide, and keeps review and approval apart", async () => {
      const pending = await find((v) => v.status === "pending_review" && v.project.code === "PRJ-RYD-014");
      for (const who of ["insA", "pm", "gs", "guard"]) expect((await decide(who, pending.id, "forward")).status).toBe(403);
      const approving = await decide("qm", pending.id, "approve");
      expect(approving.status).toBe(409); // approval is its own stage
      expect(approving.body.error.code).toBe("raqib.invalid_transition");
      const waiting = await find((v) => v.status === "pending_approval");
      expect((await decide("qe", waiting.id, "approve")).status).toBe(403); // review right is not approval right
      expect((await decide("qe", waiting.id, "return", { reason: "needs approval right" })).status).toBe(403);
    });

    it("blocks anyone from deciding on their own inspection, even if a template grants the right", async () => {
      const mine = await find((v) => v.status === "pending_review" && v.project.code === "PRJ-RYD-014");
      expect((await call("qm", "PUT", "/raqib/permissions", { changes: [{ role: "ins", module: "inspections", actions: "VAESR" }], reason: "Test self-review guard" })).status).toBe(200);
      const res = await decide("insA", mine.id, "forward");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("raqib.self_review");
      await call("qm", "PUT", "/raqib/permissions", { changes: [{ role: "ins", module: "inspections", actions: "VAES" }], reason: "Restore" });
    });

    it("keeps decisions inside the caller's project scope", async () => {
      const jeddah = await find((v) => v.status === "pending_approval");
      // pm (Riyadh only) cannot decide on Jeddah even though... they have no right at all; use a template to prove scope
      expect((await call("qm", "PUT", "/raqib/permissions", { changes: [{ role: "pm", module: "inspections", actions: "VDRP" }], reason: "Test scope guard" })).status).toBe(200);
      expect((await decide("pm", jeddah.id, "reject", { reason: "outside scope" })).status).toBe(403);
      await call("qm", "PUT", "/raqib/permissions", { changes: [{ role: "pm", module: "inspections", actions: "VD" }], reason: "Restore" });
    });
  });

  describe("forward → approve", () => {
    it("records every decision with the actor's snapshot and notifies the next person, not the actor", async () => {
      const v = await find((v) => v.status === "pending_review" && v.project.code === "PRJ-RYD-014");
      const fwd = await decide("qe", v.id, "forward", { comment: "Consistent with the evidence." });
      expect(fwd.status).toBe(200);
      expect(fwd.body.status).toBe("pending_approval");
      expect((await notifications("qm")).some((n) => n.type === "raqib.inspection_forwarded" && n.data.go[1] === v.id)).toBe(true);
      expect((await notifications("qe")).some((n) => n.type === "raqib.inspection_forwarded" && n.data.go[1] === v.id)).toBe(false);

      const appr = await decide("qm", v.id, "approve");
      expect(appr.status).toBe(200);
      expect(appr.body.status).toBe("approved");
      const after = (await call("qm", "GET", `/raqib/visits/${v.id}`)).body;
      expect(after.history.slice(-2).map((h: Json) => [h.action, h.from, h.to, h.actor.role])).toEqual([["reviewed", "pending_review", "pending_approval", "qe"], ["approved", "pending_approval", "approved", "qm"]]);
      expect(after.history.at(-2).reason).toBe("Consistent with the evidence.");
      expect((await notifications("insA")).some((n) => n.type === "raqib.inspection_approved")).toBe(true);
      expect((await notifications("pm")).some((n) => n.type === "raqib.inspection_approved")).toBe(true);
      const audit = await ownerQuery(`SELECT action FROM audit_logs WHERE action IN ('raqib.inspection.forwarded', 'raqib.inspection.approved')`);
      expect(audit.length).toBeGreaterThanOrEqual(2);
    });

    it("locks an approved inspection for good", async () => {
      const v = await find((x) => x.status === "approved" && x.project.code === "PRJ-RYD-014");
      const view = await insp("insA", v.id);
      expect(view.editable).toBe(false);
      expect((await call("insA", "PUT", `/raqib/visits/${v.id}/inspection/answers/${view.sections[0].items[0].id}`, { value: "n" })).status).toBe(409);
      expect((await decide("qm", v.id, "reject", { reason: "too late" })).status).toBe(409);
      expect((await decide("qm", v.id, "return", { reason: "too late" })).status).toBe(409);
    });
  });

  describe("reject", () => {
    it("needs a reason, is final, and tells the inspector why", async () => {
      const v = await find((x) => x.status === "pending_approval");
      expect((await decide("qm", v.id, "reject", {})).status).toBe(400);
      expect((await decide("qm", v.id, "reject", { reason: "  " })).status).toBe(400);
      const res = await decide("qm", v.id, "reject", { reason: "Evidence timestamps do not match the visit window." });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("rejected");
      const n = (await notifications("insB")).find((x) => x.type === "raqib.inspection_rejected");
      expect(n?.body).toMatch(/Evidence timestamps/);
      expect((await decide("qm", v.id, "forward")).status).toBe(409);
    });
  });

  describe("return → fix → resubmit", () => {
    let id = "";
    let unflagged = "";
    let flagged = "";

    it("requires a reason and only accepts items of this inspection", async () => {
      const v = await find((x) => x.status === "pending_review" && x.project.code === "PRJ-DMM-003");
      id = v.id;
      const view = await insp("qe", id);
      const items: Json[] = view.sections.flatMap((s: Json) => s.items);
      flagged = items.find((i) => i.key === "q13")!.id;
      unflagged = items.find((i) => i.key === "q1")!.id;
      expect((await decide("qe", id, "return", { itemIds: [flagged] })).status).toBe(400);
      expect((await decide("qe", id, "return", { reason: "Fix it", itemIds: ["iit_nope"] })).status).toBe(400);
      expect((await decide("qe", id, "return", { reason: "ab" })).status).toBe(400);
    });

    it("returns to the inspector with the flagged items unlocked and everything else locked", async () => {
      const res = await decide("qe", id, "return", { reason: "Please state which floor the plan is missing from.", itemIds: [flagged] });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("returned");
      const n = (await notifications("insB")).find((x) => x.type === "raqib.inspection_returned" && x.data.go[1] === id);
      expect(n?.body).toMatch(/which floor/);
      const view = await insp("insB", id);
      const items: Json[] = view.sections.flatMap((s: Json) => s.items);
      expect(items.find((i) => i.id === flagged)).toMatchObject({ flagged: true, locked: false });
      expect(items.find((i) => i.id === unflagged)).toMatchObject({ flagged: false, locked: true });
      expect((await call("insB", "PUT", `/raqib/visits/${id}/inspection/answers/${unflagged}`, { value: "n" })).status).toBe(409);
      expect(view.issues.map((i: Json) => i.code)).toContain("flag_untouched");
    });

    it("refuses to resubmit until the flagged item has been edited, then increments the round", async () => {
      const early = await call("insB", "POST", `/raqib/visits/${id}/inspection/submit`);
      expect(early.status).toBe(409);
      expect((early.body.error.details.issues as Json[]).map((i) => i.code)).toContain("flag_untouched");
      const edit = await call("insB", "PUT", `/raqib/visits/${id}/inspection/answers/${flagged}`, { note: "Evacuation plan not posted on floor 2 of the ambulance wing." });
      expect(edit.status).toBe(200);
      expect(edit.body.sections.flatMap((s: Json) => s.items).find((i: Json) => i.id === flagged)).toMatchObject({ fixed: true, flagged: false });
      const sub = await call("insB", "POST", `/raqib/visits/${id}/inspection/submit`);
      expect(sub.status).toBe(200);
      expect(sub.body.status).toBe("pending_review");
      expect(sub.body.round).toBe(2);
      expect(sub.body.previous).toEqual([{ round: 1, itemIds: [flagged] }]);
      const hist = (await call("qm", "GET", `/raqib/visits/${id}`)).body.history.map((h: Json) => h.action);
      expect(hist.slice(-2)).toEqual(["returned", "resubmitted"]);
      expect((await notifications("qe")).some((n) => n.type === "raqib.inspection_resubmitted")).toBe(true);
    });
  });

  describe("the decision history cannot be rewritten", () => {
    it("is immutable in the database", async () => {
      await expect(ownerQuery(`UPDATE raqib_visit_events SET reason = 'tampered' WHERE action IN ('returned', 'approved', 'rejected')`)).rejects.toThrow(/immutable/);
    });
  });
});
