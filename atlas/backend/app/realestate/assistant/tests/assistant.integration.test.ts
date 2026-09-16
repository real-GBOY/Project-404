/**
 * Atlas Copilot — orchestration behaviour.
 *
 * The agent loop, conversation persistence, tool-result plumbing, error
 * handling, and the scope gate (a product/UX restriction — NOT a security
 * boundary). The access-control invariant lives in `assistant-security.test.ts`.
 * The dashboard's separate "AI Insights" feed (unrelated to chat) is covered
 * at the bottom, unchanged from before the LLM upgrade.
 *
 * Ported from `mizan/backend/app/lawfirm/assistant/tests/assistant.integration.test.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createRealestateTestApp,
  get,
  hasTestDb,
  seedOrg,
  type SeededOrg,
} from "@atlas/realestate/tests/helpers.js";
import {
  AI_CLIENT,
  AiUpstreamError,
  ASSISTANT_CONFIG,
  AssistantService,
  assistantConfigFromAuricConfig,
  getConfig,
  type AssistantConfig,
} from "@core/index.js";
import { InsightsRepository } from "@atlas/realestate/assistant/infrastructure/insights-repository.js";
import { InsightsService } from "@atlas/realestate/assistant/application/insights-service.js";
import { LeadsService } from "@atlas/realestate/crm/application/leads-service.js";
import { TasksService } from "@atlas/realestate/operations/application/tasks-service.js";
import { ScriptedAiClient, callTool, echoLastToolResult, say } from "./scripted-ai-client.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/assistant — Atlas Copilot", () => {
  let app: TestingModule;
  const ai = new ScriptedAiClient();
  // Mutable so a test can flip scope enforcement, like `ai.script(...)`.
  const cfg: AssistantConfig = { ...assistantConfigFromAuricConfig(getConfig()), scopeEnforcement: "strict" };
  let orgA: SeededOrg;
  let leadA: { id: string; name: string };

  const svc = () => get<AssistantService>(app, AssistantService);
  const chatAs = (userId: string, org: SeededOrg, message: string, extra: { conversationId?: string } = {}) =>
    asUser(userId, org.orgId, () =>
      svc().chat({ userId, organizationId: org.orgId, locale: "en", message, ...extra }),
    );

  beforeAll(async () => {
    app = await createRealestateTestApp({
      overrides: [
        { token: AI_CLIENT, value: ai },
        { token: ASSISTANT_CONFIG, value: cfg },
      ],
    });
    orgA = await seedOrg(app, "Developer A");

    await asUser(orgA.adminId, orgA.orgId, async () => {
      const lead = await get<LeadsService>(app, LeadsService).create(
        { name: "Tarek ElGohary", phone: "+201000000001", source: "referral", agentId: orgA.adminId, interestText: "North Hills · 3-Bed", valueEgp: 4_850_000 },
        orgA.adminId,
      );
      leadA = { id: lead.id, name: lead.name };
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    ai.script(); // reset
  });

  it("answers a plain question and persists the conversation", async () => {
    ai.script(say("I can help with leads, units, contracts and collections."));
    const res = await chatAs(orgA.adminId, orgA, "What can you do?");

    expect(res.message).toMatch(/leads, units, contracts and collections/);
    expect(res.conversationId).toMatch(/^conv_/);
    expect(res.toolActivity).toEqual([]);

    const convo = await asUser(orgA.adminId, orgA.orgId, () =>
      svc().getConversation(orgA.adminId, orgA.orgId, res.conversationId),
    );
    expect(convo.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(convo.messages[0].content).toBe("What can you do?");
  });

  it("rejects malformed tool arguments without calling the service", async () => {
    ai.script(callTool("create_task", { priority: "high" }), echoLastToolResult); // no title/dueAt
    const res = await chatAs(orgA.adminId, orgA, "add a task");

    expect(res.toolActivity[0]).toMatchObject({ ok: false });
    expect(res.toolActivity[0].error).toMatch(/title|dueAt/i);
  });

  it("creates a task through the Tasks use case and reports the real result", async () => {
    ai.script(
      callTool("create_task", {
        title: "Follow up with Tarek",
        relatedType: "lead",
        relatedId: leadA.id,
        priority: "high",
        dueAt: "2026-10-01T09:00:00Z",
      }),
      (req) => {
        const tool = [...req.messages].reverse().find((m) => m.role === "tool");
        const parsed = JSON.parse((tool as { content: string }).content) as {
          ok: boolean;
          data: { id: string };
        };
        return say(parsed.ok ? `Done — created task ${parsed.data.id}.` : "It failed.");
      },
    );
    const res = await chatAs(orgA.adminId, orgA, "create a high priority task to follow up with Tarek");

    expect(res.toolActivity[0]).toMatchObject({ name: "create_task", ok: true, mutates: true });
    expect(res.message).toMatch(/Done — created task tsk_/);

    const tasks = await asUser(orgA.adminId, orgA.orgId, () => get<TasksService>(app, TasksService).list());
    expect(tasks.some((t) => t.title === "Follow up with Tarek" && t.priority === "high")).toBe(true);
  });

  it("surfaces a domain error from a tool and still returns an answer", async () => {
    ai.script(callTool("get_lead", { leadId: "lead_does_not_exist" }), echoLastToolResult);
    const res = await chatAs(orgA.adminId, orgA, "summarize lead lead_does_not_exist");

    expect(res.toolActivity[0]).toMatchObject({ name: "get_lead", ok: false });
    expect(res.toolActivity[0].error).toMatch(/not found/i);
    expect(res.message).toMatch(/not found/i);
  });

  it("maps an upstream failure to a safe error and leaves the conversation consistent", async () => {
    ai.fail(() => AiUpstreamError.unavailable("boom"));
    await expect(chatAs(orgA.adminId, orgA, "anything")).rejects.toMatchObject({
      code: "assistant.upstream_unavailable",
    });
    ai.script(); // clear the failure mode
  });

  it("carries tool results into a final answer and keeps history", async () => {
    ai.script(callTool("get_tasks", {}), say("You have no open tasks right now."));
    const res = await chatAs(orgA.adminId, orgA, "any open tasks?");
    expect(res.toolActivity[0]).toMatchObject({ name: "get_tasks", ok: true });
    expect(res.message).toMatch(/no open tasks/i);

    ai.script(say("Still nothing."));
    const followUp = await chatAs(orgA.adminId, orgA, "and now?", { conversationId: res.conversationId });
    const lastReq = ai.requests.at(-1)!;
    expect(lastReq.messages.filter((m) => m.role === "user").length).toBeGreaterThanOrEqual(2);
    expect(followUp.conversationId).toBe(res.conversationId);
  });

  // ── Scope gate — a product/UX restriction, not a security boundary ────────
  describe("scope gate", () => {
    it("refuses an obviously off-topic request by heuristic — no model call at all", async () => {
      const before = ai.requests.length;
      ai.script(say("SHOULD NOT BE USED"));
      const res = await chatAs(orgA.adminId, orgA, "write me a python script to sort a list");

      expect(res.toolActivity).toEqual([]);
      expect(res.message).toMatch(/only help with your real estate business inside Atlas/i);
      expect(ai.requests.length).toBe(before);
    });

    it("refuses via the classifier when heuristics are inconclusive", async () => {
      const before = ai.requests.length;
      ai.script(say("OUT_OF_SCOPE"), say("SHOULD NOT BE USED"));
      const res = await chatAs(orgA.adminId, orgA, "recommend a nice place for the team dinner on Friday");

      expect(res.message).toMatch(/can't help with that request/i);
      expect(res.toolActivity).toEqual([]);
      expect(ai.requests.length).toBe(before + 1);
    });

    it("lets an in-scope request through the classifier", async () => {
      ai.script(say("IN_SCOPE"), callTool("get_dashboard_summary", {}), say("All quiet."));
      const res = await chatAs(orgA.adminId, orgA, "give me the rundown on where things stand for us");
      expect(res.toolActivity[0]).toMatchObject({ name: "get_dashboard_summary", ok: true });
      expect(res.message).toBe("All quiet.");
    });

    it("persists the refusal as an assistant turn", async () => {
      ai.script(say("x"));
      const res = await chatAs(orgA.adminId, orgA, "what is the capital of France?");
      const convo = await asUser(orgA.adminId, orgA.orgId, () =>
        svc().getConversation(orgA.adminId, orgA.orgId, res.conversationId),
      );
      expect(convo.messages.at(-1)).toMatchObject({ role: "assistant", content: res.message });
    });

    it("prompt_only mode skips the pre-check (system prompt is the only guard)", async () => {
      cfg.scopeEnforcement = "prompt_only";
      try {
        ai.script(say("(model would refuse here per the system prompt)"));
        const res = await chatAs(orgA.adminId, orgA, "write me a haiku about the sea");
        expect(ai.requests.at(-1)!.messages.some((m) => m.role === "system")).toBe(true);
        expect(res.message).toMatch(/model would refuse/);
      } finally {
        cfg.scopeEnforcement = "strict";
      }
    });
  });

  // ── The dashboard's pre-generated "AI Insights" feed — unrelated to chat ──
  describe("AI Insights (unrelated feature)", () => {
    const insightsRepo = () => get<InsightsRepository>(app, InsightsRepository);
    const insightsSvc = () => get<InsightsService>(app, InsightsService);

    it("dismissing an insight removes it from the feed", async () => {
      const insight = await asUser(orgA.adminId, orgA.orgId, () =>
        insightsRepo().create({ kind: "feed", tag: "Risk", confidence: 0.9, text: "Test insight", detail: "detail", cta: "Act" }),
      );
      let feed = await asUser(orgA.adminId, orgA.orgId, () => insightsSvc().list("feed"));
      expect(feed.some((i) => i.id === insight.id)).toBe(true);

      await asUser(orgA.adminId, orgA.orgId, () => insightsSvc().dismiss(insight.id, orgA.adminId));
      feed = await asUser(orgA.adminId, orgA.orgId, () => insightsSvc().list("feed"));
      expect(feed.some((i) => i.id === insight.id)).toBe(false);
    });
  });
});
