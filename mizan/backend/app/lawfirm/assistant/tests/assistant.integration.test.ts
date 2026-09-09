import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createMizanTestApp,
  get,
  hasTestDb,
  seedFirm,
  seedMember,
  type SeededFirm,
} from "@app/lawfirm/tests/helpers.js";
import { AI_CLIENT } from "@app/lawfirm/assistant/ai/ai-client.js";
import { AiUpstreamError } from "@app/lawfirm/assistant/ai/ai-client.js";
import { AssistantService } from "@app/lawfirm/assistant/assistant-service.js";
import { ClientsService } from "@app/lawfirm/clients/clients-service.js";
import { MattersService } from "@app/lawfirm/matters/matters-service.js";
import { TasksService } from "@app/lawfirm/tasks/tasks-service.js";
import { ScriptedAiClient, callTool, echoLastToolResult, say } from "./scripted-ai-client.js";

const suite = hasTestDb ? describe : describe.skip;

suite("lawfirm/assistant — Mizan Copilot", () => {
  let app: TestingModule;
  const ai = new ScriptedAiClient();
  let firmA: SeededFirm;
  let firmB: SeededFirm;
  let readerId: string; // read_only member of firm A
  let matterA: { id: string; title: string };

  const svc = () => get<AssistantService>(app, AssistantService);
  const chatAs = (
    userId: string,
    firm: SeededFirm,
    message: string,
    extra: { conversationId?: string; currentContext?: Record<string, string> } = {},
  ) =>
    asUser(userId, firm.orgId, () =>
      svc().chat({
        userId,
        organizationId: firm.orgId,
        locale: "en",
        message,
        ...extra,
      }),
    );

  beforeAll(async () => {
    app = await createMizanTestApp({
      overrides: [{ token: AI_CLIENT, value: ai }],
    });
    firmA = await seedFirm(app, "Firm A");
    firmB = await seedFirm(app, "Firm B");
    readerId = await seedMember(app, firmA, "read_only", "Auditor");

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

  // 1 ─ AI service: a plain turn round-trips and is persisted
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

  // 2 ─ Authentication / ownership: another user cannot touch your conversation
  it("refuses a conversation that belongs to a different user", async () => {
    ai.script(say("first"));
    const { conversationId } = await chatAs(firmA.adminId, firmA, "hello");

    ai.script(say("second"));
    await expect(chatAs(readerId, firmA, "continue please", { conversationId })).rejects.toThrow(
      /conversation was not found/i,
    );

    await expect(
      asUser(readerId, firmA.orgId, () =>
        svc().getConversation(readerId, firmA.orgId, conversationId),
      ),
    ).rejects.toThrow(/not found/i);
  });

  // 3 ─ Organization isolation: firm B cannot resume firm A's conversation
  it("refuses another organization's conversation id", async () => {
    ai.script(say("hi from A"));
    const { conversationId } = await chatAs(firmA.adminId, firmA, "hello");

    ai.script(say("hi from B"));
    await expect(
      chatAs(firmB.adminId, firmB, "what did we say?", { conversationId }),
    ).rejects.toThrow(/not found/i);
  });

  // 4 ─ Tool authorization: a read-only user cannot drive a write tool
  it("blocks a write tool the caller lacks permission for, and does not execute it", async () => {
    ai.script(
      callTool("create_task", { title: "Reader-made task", matterId: matterA.id }),
      echoLastToolResult,
    );
    const res = await chatAs(readerId, firmA, "make a task to review the contract");

    expect(res.toolActivity).toHaveLength(1);
    expect(res.toolActivity[0]).toMatchObject({ name: "create_task", ok: false, mutates: true });
    expect(res.toolActivity[0].error).toMatch(/permission/i);

    const tasks = await asUser(firmA.adminId, firmA.orgId, () =>
      get<TasksService>(app, TasksService).list({ actorId: firmA.adminId }),
    );
    expect(tasks.items.some((t) => t.title === "Reader-made task")).toBe(false);
  });

  // 5 ─ Tool argument validation
  it("rejects malformed tool arguments without calling the service", async () => {
    ai.script(callTool("create_task", { matterId: matterA.id }), echoLastToolResult); // no title
    const res = await chatAs(firmA.adminId, firmA, "add a task");

    expect(res.toolActivity[0]).toMatchObject({ ok: false });
    expect(res.toolActivity[0].error).toMatch(/title/i);
  });

  // 6 ─ Successful write: the task really exists afterwards
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

  // 7 ─ Failed tool execution surfaces the real error, no crash
  it("surfaces a domain error from a tool and still returns an answer", async () => {
    ai.script(callTool("get_matter", { matterId: "mat_does_not_exist" }), echoLastToolResult);
    const res = await chatAs(firmA.adminId, firmA, "summarize matter mat_does_not_exist");

    expect(res.toolActivity[0]).toMatchObject({ name: "get_matter", ok: false });
    expect(res.toolActivity[0].error).toMatch(/not found/i);
    expect(res.message).toMatch(/not found/i);
  });

  // 8 ─ Upstream model/API failure fails safely
  it("maps an upstream failure to a safe error and leaves the conversation consistent", async () => {
    ai.fail(() => AiUpstreamError.unavailable("boom"));
    await expect(chatAs(firmA.adminId, firmA, "anything")).rejects.toMatchObject({
      code: "assistant.upstream_unavailable",
    });
    ai.script(); // clear the failure mode
  });

  // 9 ─ A user cannot use the AI to read another organization's data
  it("a tool call runs in the caller's tenant — firm B cannot reach firm A's matter", async () => {
    ai.script(callTool("get_matter", { matterId: matterA.id }), echoLastToolResult);
    const res = await chatAs(firmB.adminId, firmB, `look up matter ${matterA.id}`);

    expect(res.toolActivity[0]).toMatchObject({ ok: false });
    expect(res.message).not.toContain(matterA.title);

    // And firm B's own search sees none of firm A's matters.
    ai.script(callTool("search_matters", {}), echoLastToolResult);
    const search = await chatAs(firmB.adminId, firmB, "list our matters");
    expect(search.message).not.toContain("Orion");
  });

  // 10 ─ The authenticated user's tenant/authz context is what tools use
  it("the same tool returns each firm its own data", async () => {
    ai.script(callTool("search_matters", { query: "Orion" }), echoLastToolResult);
    const a = await chatAs(firmA.adminId, firmA, "find the Orion matter");
    expect(a.message).toContain("Orion facility dispute");

    ai.script(callTool("search_matters", { query: "Orion" }), echoLastToolResult);
    const b = await chatAs(firmB.adminId, firmB, "find the Orion matter");
    expect(b.message).not.toContain("Orion facility dispute");
  });

  // Bonus ─ multi-step: tool call then a natural-language answer, history preserved
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
    // The second request must have been given the prior turns.
    const lastReq = ai.requests.at(-1)!;
    expect(lastReq.messages.filter((m) => m.role === "user").length).toBeGreaterThanOrEqual(2);
    expect(followUp.conversationId).toBe(res.conversationId);
  });
});
