/**
 * Requirement 17: guards get surveys and a confidential channel. Managing surveys is a named designation; the ANSWERS are
 * confidential reports, readable only by people with an explicit grant (and an open session), never by survey managers or
 * general quality management, and they never surface through search, notifications or the survey API itself.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib surveys and the confidential boundary", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  let surveyId = "";
  let qeId = "";

  const call = async (who: string, method: "GET" | "POST" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json,
      text: res.body,
    };
  };
  const conf = (who: string, url: string) => call(who, "GET", `/raqib/confidential${url}`);
  const enter = (who: string) => call(who, "POST", "/raqib/confidential/session", { reason: "investigation", ack: true });

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "gm", "legal", "guard", "turki", "insA", "gs"]) tokens[key] = await loginAs(http, email(key));
    qeId = (await call("qe", "GET", "/raqib/me")).body.id;
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  const questions = [
    { type: "rating", text: { ar: "هل تشعر بالأمان في موقعك؟", en: "Do you feel safe at your post?" } },
    { type: "text", text: { ar: "ما الذي يمكن تحسينه؟", en: "What could be improved?" } },
  ];
  const survey = { title: { ar: "استبيان الرضا", en: "Satisfaction survey" }, intro: { ar: "", en: "" }, questions };

  describe("managing surveys is a named designation", () => {
    it("nobody creates a survey until the General Manager has named them", async () => {
      for (const who of ["qm", "qe", "pm", "gm", "guard"]) expect((await call(who, "POST", "/raqib/surveys", survey)).status).toBe(403);
    });

    it("only the General Manager names or removes a manager, and is told who could be named", async () => {
      expect((await call("qm", "POST", "/raqib/surveys/managers", { userId: qeId })).status).toBe(403);
      expect((await call("guard", "POST", "/raqib/surveys/managers", { userId: qeId })).status).toBe(403);
      const forGm = (await call("gm", "GET", "/raqib/surveys")).body;
      expect(forGm.candidates.map((c: Json) => c.userId)).toContain(qeId);
      expect((await call("qm", "GET", "/raqib/surveys")).body.managers).toBeNull();
      expect((await call("gm", "POST", "/raqib/surveys/managers", { userId: qeId })).status).toBe(204);
      expect((await call("gm", "POST", "/raqib/surveys/managers", { userId: qeId })).status).toBe(409);
      expect((await call("qe", "GET", "/raqib/surveys")).body.canManage).toBe(true);
    });

    it("a manager drafts, publishes and closes a survey; guards see only open ones", async () => {
      expect((await call("qe", "POST", "/raqib/surveys", { ...survey, questions: [] })).status).toBe(400);
      const made = await call("qe", "POST", "/raqib/surveys", survey);
      expect(made.status).toBe(201);
      surveyId = made.body.id;
      expect(made.body.questions.map((q: Json) => q.key)).toEqual(["q1", "q2"]);
      expect(((await call("guard", "GET", "/raqib/surveys")).body.items as Json[]).length).toBe(0); // a draft is not shown
      expect((await call("guard", "POST", `/raqib/surveys/${surveyId}/answers`, { answers: { q1: 4 }, identity: "anonymous" })).status).toBe(409); // not open yet
      expect((await call("guard", "POST", `/raqib/surveys/${surveyId}/publish`)).status).toBe(403);
      expect((await call("qe", "POST", `/raqib/surveys/${surveyId}/publish`)).body.status).toBe("active");
      expect((await call("qe", "POST", `/raqib/surveys/${surveyId}/publish`)).status).toBe(409);
      const seen = (await call("guard", "GET", "/raqib/surveys")).body;
      expect(seen.items.map((s: Json) => s.id)).toEqual([surveyId]);
      expect(seen.canManage).toBe(false);
    });
  });

  describe("answers are confidential reports", () => {
    it("validates the answers, then stores them as confidential reports (anonymous or not)", async () => {
      const bad = await call("guard", "POST", `/raqib/surveys/${surveyId}/answers`, { answers: { q1: 9, q2: "x" }, identity: "anonymous" });
      expect(bad.status).toBe(400);
      expect((await call("guard", "POST", `/raqib/surveys/${surveyId}/answers`, { answers: { q2: "x" }, identity: "anonymous" })).status).toBe(400);
      const anon = await call("guard", "POST", `/raqib/surveys/${surveyId}/answers`, {
        answers: { q1: 2, q2: "The lighting at the north fence is poor." },
        identity: "anonymous",
      });
      expect(anon.status).toBe(201);
      expect(anon.body.ref).toMatch(/^CNF-26-/);
      const named = await call("turki", "POST", `/raqib/surveys/${surveyId}/answers`, { answers: { q1: 5, q2: "Nothing." }, identity: "named" });
      expect(named.status).toBe(201);
    });

    it("the survey API never returns answers, and a manager cannot read them", async () => {
      for (const who of ["qe", "guard", "gm"]) expect((await call(who, "GET", "/raqib/surveys")).text).not.toContain("lighting at the north fence");
      expect((await conf("qe", "/reports")).body.error.code).toBe("raqib.conf_no_grant"); // survey manager is not a confidential grant
    });

    it("general quality management does not read them either, without a grant AND an entry", async () => {
      // the Director of Quality does hold a grant in the demo, but is refused until they enter with a reason
      expect((await conf("qm", "/reports")).body.error.code).toBe("raqib.conf_session_required");
      for (const who of ["qe", "pm", "insA", "gs", "gm", "guard"]) expect((await conf(who, "/reports")).body.error.code).toBe("raqib.conf_no_grant");
      expect((await enter("qm")).status).toBe(200);
      const all = (await conf("qm", "/reports")).body.items as Json[];
      const mine = all.filter((r) => r.kind === "survey");
      expect(mine).toHaveLength(2);
      const detail = (await conf("qm", `/reports/${mine.find((r) => r.subject.includes("Satisfaction"))!.id}`)).body;
      expect(detail.body).toContain("Do you feel safe at your post?");
      // an anonymous answer has no identity to reveal
      expect(JSON.stringify(mine)).not.toMatch(/Anazi|Turki/i);
    });

    it("a direct URL is refused for everyone without a grant", async () => {
      const id = ((await conf("qm", "/reports")).body.items as Json[]).find((r) => r.kind === "survey")!.id;
      for (const who of ["qe", "pm", "gm", "guard", "insA"]) expect((await conf(who, `/reports/${id}`)).status).toBe(403);
      const withNoSession = await conf("legal", `/reports/${id}`);
      expect(withNoSession.status).toBe(403); // a grant without an entry is not enough
    });

    it("never surfaces through search, and notifications carry no content", async () => {
      for (const who of ["qm", "qe", "gm", "pm"]) {
        const hits = (await call(who, "GET", "/raqib/search?q=lighting")).body;
        expect(JSON.stringify(hits)).not.toMatch(/lighting|CNF-26/);
        const byRef = (await call(who, "GET", "/raqib/search?q=CNF-26")).body;
        expect(JSON.stringify(byRef)).not.toMatch(/CNF-26/);
      }
      const notes = ((await call("qm", "GET", "/notifications")).body.notifications as Json[]).filter((n) => n.type === "raqib.conf_new");
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) expect(`${n.title} ${n.body}`).not.toMatch(/lighting|north fence|safe at your post|Satisfaction/);
    });
  });
});
