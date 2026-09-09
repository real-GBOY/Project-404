/**
 * Mizan Copilot — orchestration behaviour.
 *
 * The agent loop, conversation persistence, tool-result plumbing, error
 * handling, and the scope gate (a product/UX restriction — NOT a security
 * boundary). The access-control invariant lives in `assistant-security.test.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createMizanTestApp,
  get,
  hasTestDb,
  seedFirm,
  type SeededFirm,
} from "@app/lawfirm/tests/helpers.js";
import { AI_CLIENT, AiUpstreamError } from "@app/lawfirm/assistant/ai/ai-client.js";
import {
  ASSISTANT_CONFIG,
  readAssistantConfig,
  type AssistantConfig,
} from "@app/lawfirm/assistant/assistant-config.js";
import { AssistantService } from "@app/lawfirm/assistant/assistant-service.js";
import { ClientsService } from "@app/lawfirm/clients/clients-service.js";
import { MattersService } from "@app/lawfirm/matters/matters-service.js";
import { TasksService } from "@app/lawfirm/tasks/tasks-service.js";
import { ScriptedAiClient, callTool, echoLastToolResult, say } from "./scripted-ai-client.js";

const suite = hasTestDb ? describe : describe.skip;

suite("lawfirm/assistant — Mizan Copilot", () => {
  let app: TestingModule;
  const ai = new ScriptedAiClient();
  // Mutable so a test can flip scope enforcement, like `ai.script(...)`.
  const cfg: AssistantConfig = { ...readAssistantConfig(), scopeEnforcement: "strict" };
  let firmA: SeededFirm;
  let matterA: { id: string; title: string };

  const svc = () => get<AssistantService>(app, AssistantService);
  const chatAs = (
    userId: string,
    firm: SeededFirm,
    message: string,
    extra: { conversationId?: string } = {},
  ) =>
    asUser(userId, firm.orgId, () =>
      svc().chat({ userId, organizationId: firm.orgId, locale: "en", message, ...extra }),
    );

  beforeAll(async () => {
    app = await createMizanTestApp({
      overrides: [
        { token: AI_CLIENT, value: ai },
        { token: ASSISTANT_CONFIG, value: cfg },
      ],
    });
    firmA = await seedFirm(app, "Firm A");

    await asUser(firmA.adminId, firmA.orgId, async () => {
      const client = await get<ClientsService>(app, ClientsService).create(
        {
          name: "Orion Holdings",
          type: "company",
          email: null,
          phone: null,
          taxId: null,
          address: null,
          notes: null,
        },
        firmA.adminId,
      );
      const matter = await get<MattersService>(app, MattersService).create(
        { title: "Orion facility dispute", clientId: client.id, practiceArea: "Litigation" },
        firmA.adminId,
      );
      matterA = { id: matter.id, title: matter.title };
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    ai.script(); // reset
  });

  it("answers a plain question and persists the conversation", async () => {
    ai.script(say("I can help with hearings, tasks and billing."));
    const res = await chatAs(firmA.adminId, firmA, "What can you do?");

    expect(res.message).toMatch(/hearings, tasks and billing/);
    expect(res.conversationId).toMatch(/^conv_/);
    expect(res.toolActivity).toEqual([]);

    const convo = await asUser(firmA.adminId, firmA.orgId, () =>
      svc().getConversation(firmA.adminId, firmA.orgId, res.conversationId),
    );
    expect(convo.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(convo.messages[0].content).toBe("What can you do?");
  });

  it("rejects malformed tool arguments without calling the service", async () => {
    ai.script(callTool("create_task", { matterId: matterA.id }), echoLastToolResult); // no title
    const res = await chatAs(firmA.adminId, firmA, "add a task");

    expect(res.toolActivity[0]).toMatchObject({ ok: false });
    expect(res.toolActivity[0].error).toMatch(/title/i);
  });

  it("creates a task through the Tasks use case and reports the real result", async () => {
    ai.script(
      callTool("create_task", {
        title: "Review the Orion contract",
        matterId: matterA.id,
        priority: "high",
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
    const res = await chatAs(
      firmA.adminId,
      firmA,
      "create a high priority task to review the Orion contract",
    );

    expect(res.toolActivity[0]).toMatchObject({ name: "create_task", ok: true, mutates: true });
    expect(res.message).toMatch(/Done — created task tsk_/);

    const tasks = await asUser(firmA.adminId, firmA.orgId, () =>
      get<TasksService>(app, TasksService).list({ actorId: firmA.adminId, matterId: matterA.id }),
    );
    expect(
      tasks.items.some((t) => t.title === "Review the Orion contract" && t.priority === "high"),
    ).toBe(true);
  });

  it("surfaces a domain error from a tool and still returns an answer", async () => {
    ai.script(callTool("get_matter", { matterId: "mat_does_not_exist" }), echoLastToolResult);
    const res = await chatAs(firmA.adminId, firmA, "summarize matter mat_does_not_exist");

    expect(res.toolActivity[0]).toMatchObject({ name: "get_matter", ok: false });
    expect(res.toolActivity[0].error).toMatch(/not found/i);
    expect(res.message).toMatch(/not found/i);
  });

  it("maps an upstream failure to a safe error and leaves the conversation consistent", async () => {
    ai.fail(() => AiUpstreamError.unavailable("boom"));
    await expect(chatAs(firmA.adminId, firmA, "anything")).rejects.toMatchObject({
      code: "assistant.upstream_unavailable",
    });
    ai.script(); // clear the failure mode
  });

  it("carries tool results into a final answer and keeps history", async () => {
    ai.script(
      callTool("get_tasks", { range: "overdue" }),
      say("You have no overdue tasks right now."),
    );
    const res = await chatAs(firmA.adminId, firmA, "any overdue tasks?");
    expect(res.toolActivity[0]).toMatchObject({ name: "get_tasks", ok: true });
    expect(res.message).toMatch(/no overdue tasks/i);

    ai.script(say("Still nothing overdue."));
    const followUp = await chatAs(firmA.adminId, firmA, "and now?", {
      conversationId: res.conversationId,
    });
    const lastReq = ai.requests.at(-1)!;
    expect(lastReq.messages.filter((m) => m.role === "user").length).toBeGreaterThanOrEqual(2);
    expect(followUp.conversationId).toBe(res.conversationId);
  });

  // ── Scope gate — a product/UX restriction, not a security boundary ────────
  describe("scope gate", () => {
    it("refuses an obviously off-topic request by heuristic — no model call at all", async () => {
      const before = ai.requests.length;
      ai.script(say("SHOULD NOT BE USED"));
      const res = await chatAs(firmA.adminId, firmA, "write me a python script to sort a list");

      expect(res.toolActivity).toEqual([]);
      expect(res.message).toMatch(/only help with your firm's work inside Mizan/i);
      expect(ai.requests.length).toBe(before);
    });

    it("refuses via the classifier when heuristics are inconclusive", async () => {
      const before = ai.requests.length;
      ai.script(say("OUT_OF_SCOPE"), say("SHOULD NOT BE USED"));
      const res = await chatAs(
        firmA.adminId,
        firmA,
        "recommend a nice place for the team dinner on Friday",
      );

      expect(res.message).toMatch(/can't help with that request/i);
      expect(res.toolActivity).toEqual([]);
      expect(ai.requests.length).toBe(before + 1);
    });

    it("lets an in-scope request through the classifier", async () => {
      ai.script(say("IN_SCOPE"), callTool("get_dashboard_summary", {}), say("All quiet."));
      const res = await chatAs(
        firmA.adminId,
        firmA,
        "give me the rundown on where things stand for us",
      );
      expect(res.toolActivity[0]).toMatchObject({ name: "get_dashboard_summary", ok: true });
      expect(res.message).toBe("All quiet.");
    });

    it("persists the refusal as an assistant turn", async () => {
      ai.script(say("x"));
      const res = await chatAs(firmA.adminId, firmA, "what is the capital of France?");
      const convo = await asUser(firmA.adminId, firmA.orgId, () =>
        svc().getConversation(firmA.adminId, firmA.orgId, res.conversationId),
      );
      expect(convo.messages.at(-1)).toMatchObject({ role: "assistant", content: res.message });
    });

    it("prompt_only mode skips the pre-check (system prompt is the only guard)", async () => {
      cfg.scopeEnforcement = "prompt_only";
      try {
        ai.script(say("(model would refuse here per the system prompt)"));
        const res = await chatAs(firmA.adminId, firmA, "write me a haiku about the sea");
        expect(ai.requests.at(-1)!.messages.some((m) => m.role === "system")).toBe(true);
        expect(res.message).toMatch(/model would refuse/);
      } finally {
        cfg.scopeEnforcement = "strict";
      }
    });
  });
});
