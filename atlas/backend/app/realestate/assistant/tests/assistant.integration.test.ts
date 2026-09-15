import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createRealestateTestApp,
  get,
  hasTestDb,
  seedOrg,
  type SeededOrg,
} from "@atlas/realestate/tests/helpers.js";
import { AssistantService } from "@atlas/realestate/assistant/assistant-service.js";
import { InsightsRepository } from "@atlas/realestate/assistant/insights-repository.js";
import { InsightsService } from "@atlas/realestate/assistant/insights-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/assistant", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const assistant = () => get<AssistantService>(app, AssistantService);
  const insightsRepo = () => get<InsightsRepository>(app, InsightsRepository);
  const insightsSvc = () => get<InsightsService>(app, InsightsService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("ask() creates a conversation, persists both turns, and answers with a real query for outstanding", async () => {
    const { conversationId, message } = await asUser(orgA.adminId, orgA.orgId, () =>
      assistant().ask(undefined, "How much revenue is currently outstanding?", orgA.adminId),
    );
    expect(conversationId).toMatch(/^conv_/);
    expect(message.role).toBe("ai");

    const history = await asUser(orgA.adminId, orgA.orgId, () => assistant().messages(conversationId));
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("ai");
  });

  it("a follow-up question reuses the same conversation", async () => {
    const first = await asUser(orgA.adminId, orgA.orgId, () => assistant().ask(undefined, "sales velocity?", orgA.adminId));
    const second = await asUser(orgA.adminId, orgA.orgId, () =>
      assistant().ask(first.conversationId, "what about underperforming agents?", orgA.adminId),
    );
    expect(second.conversationId).toBe(first.conversationId);
    const history = await asUser(orgA.adminId, orgA.orgId, () => assistant().messages(first.conversationId));
    expect(history).toHaveLength(4);
  });

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

  it("tenant isolation: developer B cannot see developer A's conversations", async () => {
    const { conversationId } = await asUser(orgA.adminId, orgA.orgId, () =>
      assistant().ask(undefined, "velocity?", orgA.adminId),
    );
    const bConversations = await asUser(orgB.adminId, orgB.orgId, () => assistant().conversations(orgA.adminId));
    expect(bConversations.some((c) => c.id === conversationId)).toBe(false);
  });
});
