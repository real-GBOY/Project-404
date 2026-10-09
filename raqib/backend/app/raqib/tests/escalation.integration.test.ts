/**
 * Corrective-action escalation: an unresolved action escalates once at each configured day threshold (3, 6, 9 by
 * default), tells the configured people in-app and by email, writes the escalation into the action history, stops when
 * the work is handed over, and a high-severity finding is announced at once. The counting rule and recipients are settings.
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

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasTestDb)("Raqib action escalation", () => {
  let http: NestFastifyApplication;
  let runner: JobsRunner;
  const clock = fixedClock("2026-10-04T08:00:00.000Z");
  const tokens: Record<string, string> = {};
  let actionId = "";
  let responsibleKey = "";
  let created: Date;

  const call = async (who: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json };
  };
  const notes = async (who: string, type: string) => ((await call(who, "GET", "/notifications")).body.notifications as Json[]).filter((n) => n.type === type);
  /** Escalation notices about the action under test (the job escalates every open action in the organization). */
  const aboutAction = async (who: string) => (await notes(who, "raqib.action_escalated")).filter((n) => n.data?.go?.[1] === actionId);
  const escalations = async () => (await call("qm", "GET", `/raqib/actions/${actionId}`)).body.log.filter((l: Json) => l.kind === "escalated");
  // sign-in tokens expire, so each move of the clock is followed by a fresh sign-in
  const signIn = async () => {
    for (const key of ["qm", "pm", "gm", "sultan", ...(responsibleKey ? [responsibleKey] : [])]) tokens[key] = await loginAs(http, email(key));
  };
  const at = async (days: number) => {
    clock.set(new Date(created.getTime() + days * 86_400_000));
    await signIn();
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock });
    http = booted.http;
    runner = get<JobsRunner>(booted.moduleRef, JobsRunner);
    for (const key of ["qm", "pm", "gm", "sultan"]) tokens[key] = await loginAs(http, email(key));
    // an open action that has not been handed to quality review yet
    const open = ((await call("qm", "GET", "/raqib/actions")).body.items as Json[]).find((a) =>
      ["assigned", "in_progress", "returned"].includes(a.storedStatus),
    )!;
    actionId = open.id;
    // the person this action is assigned to
    responsibleKey = DEMO_PEOPLE.find((p) => p.name.en === open.responsible.name.en)!.key;
    tokens[responsibleKey] = await loginAs(http, email(responsibleKey));
    const row = (await ownerQuery<{ created_at: Date }>(`SELECT created_at FROM raqib_corrective_actions WHERE id = $1`, [actionId]))[0]!;
    created = row.created_at;
    // start from a clean slate: the demo may already be past some thresholds
    await ownerQuery(`UPDATE raqib_corrective_actions SET escalation_level = 0 WHERE id = $1`, [actionId]);
    await ownerQuery(`DELETE FROM notifications WHERE type IN ('raqib.action_escalated', 'raqib.observation_high')`);
    await ownerQuery(`DELETE FROM outbox_messages WHERE event_name = 'notification.email_requested'`);
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  it("does nothing before the first threshold", async () => {
    await at(2);
    await runner.tick();
    expect(await escalations()).toHaveLength(0);
  });

  it("escalates at 3 days to the responsible person and the project manager, in-app and by email", async () => {
    await at(3);
    expect((await runner.tick())?.actionsEscalated).toBeGreaterThanOrEqual(1);
    const log = await escalations();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ text: "L1 · 3d", actor: { role: null } });
    expect((await aboutAction(responsibleKey)).length).toBe(1);
    const mails = await ownerQuery<{ payload: Json }>(`SELECT payload FROM outbox_messages WHERE event_name = 'notification.email_requested'`);
    expect(mails.some((m) => m.payload.templateKey === "raqib.action_escalated" && m.payload.to === email(responsibleKey))).toBe(true);
    // announced once: running the job again, or an hour later, repeats nothing
    await runner.tick();
    clock.advance(3_600_000);
    await signIn();
    await runner.tick();
    expect(await escalations()).toHaveLength(1);
  });

  it("moves up to the quality director at 6 days and to the General Manager at 9", async () => {
    await at(6);
    await runner.tick();
    expect(await escalations()).toHaveLength(2);
    expect((await aboutAction("qm")).length).toBe(1);
    expect((await aboutAction("gm")).length).toBe(0);
    await at(9);
    await runner.tick();
    expect(await escalations()).toHaveLength(3);
    expect((await aboutAction("gm")).length).toBe(1);
    await at(30);
    await runner.tick();
    expect(await escalations()).toHaveLength(3); // there is no level past the last
    expect(
      (await ownerQuery<{ escalation_level: number }>(`SELECT escalation_level FROM raqib_corrective_actions WHERE id = $1`, [actionId]))[0]!.escalation_level,
    ).toBe(3);
  });

  it("follows the settings: a different rule changes when and who", async () => {
    await ownerQuery(`UPDATE raqib_corrective_actions SET escalation_level = 0 WHERE id = $1`, [actionId]);
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    const set = await call("qm", "PUT", "/raqib/settings", {
      settings: { ...cur, escalation: { ...cur.escalation, countFrom: "due", levels: [{ days: 1, roles: ["gm"] }] } },
      reason: "client confirmed a one-level rule",
    });
    expect(set.status).toBe(200);
    const due = (await ownerQuery<{ due: string }>(`SELECT due_date::text AS due FROM raqib_corrective_actions WHERE id = $1`, [actionId]))[0]!.due;
    clock.set(new Date(`${due}T12:00:00Z`));
    await signIn();
    await runner.tick();
    expect(await escalations()).toHaveLength(3); // nothing yet: zero days past the due date
    clock.set(new Date(new Date(`${due}T12:00:00Z`).getTime() + 86_400_000));
    await signIn();
    await runner.tick();
    expect(await escalations()).toHaveLength(4);
  });

  it("rejects an escalation rule that makes no sense", async () => {
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    const bad = (escalation: Json) => call("qm", "PUT", "/raqib/settings", { settings: { ...cur, escalation }, reason: "invalid rule" });
    expect((await bad({ ...cur.escalation, levels: [] })).status).toBe(400);
    expect(
      (
        await bad({
          ...cur.escalation,
          levels: [
            { days: 3, roles: ["pm"] },
            { days: 3, roles: ["qm"] },
          ],
        })
      ).status,
    ).toBe(400);
    expect((await bad({ ...cur.escalation, levels: [{ days: 3, roles: ["nobody"] }] })).status).toBe(400);
  });

  it("announces a high-severity observation at once, to the configured roles, in-app and by email", async () => {
    // restore the default rule for this check
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    await call("qm", "PUT", "/raqib/settings", {
      settings: {
        ...cur,
        escalation: {
          ...cur.escalation,
          countFrom: "assigned",
          levels: [
            { days: 3, roles: ["responsible", "pm"] },
            { days: 6, roles: ["pm", "qm"] },
            { days: 9, roles: ["qm", "gm"] },
          ],
        },
      },
      reason: "restore defaults",
    });
    const project = ((await call("qm", "GET", "/raqib/projects")).body.items as Json[]).find((p) => p.code && (p.sites?.length ?? 0) > 0) ?? null;
    const visit = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.project.code === (project?.code ?? v.project.code))!;
    // a low-severity one tells nobody...
    await call("qm", "POST", "/raqib/observations", {
      projectId: visit.project.id,
      siteId: visit.site.id,
      text: "Minor housekeeping issue",
      note: "",
      severity: "low",
    });
    expect((await notes("pm", "raqib.observation_high")).length).toBe(0);
    // ...a high one reaches the project manager and quality at once
    const high = await call("qm", "POST", "/raqib/observations", {
      projectId: visit.project.id,
      siteId: visit.site.id,
      text: "Perimeter fence breached",
      note: "Gap of two metres",
      severity: "high",
    });
    expect(high.status).toBe(201);
    const mails = await ownerQuery<{ payload: Json }>(`SELECT payload FROM outbox_messages WHERE event_name = 'notification.email_requested'`);
    expect(mails.some((m) => m.payload.templateKey === "raqib.observation_high")).toBe(true);
    const everyone = await Promise.all(["pm", "sultan", "qm"].map((k) => notes(k, "raqib.observation_high")));
    expect(everyone.flat().length).toBeGreaterThanOrEqual(1);
  });
});
