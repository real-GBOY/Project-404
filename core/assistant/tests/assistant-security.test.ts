/**
 * AURIC Core — AI Copilot infrastructure, security invariant.
 *
 * Proves the *generic* pipeline (core/assistant) enforces its boundary with no
 * knowledge of any product's business domain: a fake two-tool, two-permission
 * domain stands in for what a real product would supply via `ASSISTANT_TOOLS`.
 * Product-specific security (real tools against real services) is proven
 * separately in each product's own `tests/assistant-security.test.ts` — this
 * file is the "minimum verification checklist" from core/assistant/README.md:
 * org isolation, user isolation, RBAC-per-tool, unknown tools rejected, no
 * database/arbitrary-tool pathway.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { z } from "zod";
import { AppModule } from "@core/app.module.js";
import { AppError } from "@core/kernel/errors.js";
import {
  AI_CLIENT,
  ASSISTANT_CONFIG,
  ASSISTANT_DOMAIN_CONFIG,
  ASSISTANT_TOOLS,
  SCOPE_GUARD_CONFIG,
  WORKER_AUTOSTART,
} from "@core/kernel/tokens.js";
import { AuditModule } from "@core/audit/audit.module.js";
import { RbacModule } from "@core/rbac/rbac.module.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { IdentityModule } from "@core/identity/identity.module.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationsModule } from "@core/organizations/organizations.module.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import type { AssistantConfig } from "@core/assistant/domain/assistant-config.js";
import type { AssistantDomainConfig } from "@core/assistant/domain/assistant-domain.js";
import type { ScopeGuardConfig } from "@core/assistant/domain/scope-guard-config.js";
import type { AssistantTool } from "@core/assistant/domain/tool.js";
import { ConversationRepository } from "@core/assistant/infrastructure/conversation-repository.js";
import { ScopeGuard } from "@core/assistant/application/scope-guard.js";
import { ToolRegistry } from "@core/assistant/application/tool-registry.js";
import { AssistantService } from "@core/assistant/application/assistant-service.js";
import {
  applyTestConfig,
  asUser,
  get,
  hasTestDb,
  resetSchema,
  TEST_DATABASE_URL,
} from "@core/tests/helpers.js";
import { migrateToLatest } from "@core/kernel/db/migrate.js";
import { SeedService } from "@core/bootstrap/seed.service.js";
import { callTool, say, ScriptedAiClient } from "./scripted-ai-client.js";

const suite = hasTestDb ? describe : describe.skip;

// ── A fake, minimal "product" domain — stands in for a real product's tools ──
const FAKE_TOOLS: AssistantTool[] = [
  {
    name: "ping",
    description: "Health check. No permission required.",
    permission: null,
    parameters: z.object({}),
    execute: async () => ({ pong: true }),
  },
  {
    name: "get_secret",
    description: "Returns a fake secret. Requires read:secret_thing.",
    permission: { action: "read", resource: "secret_thing" },
    parameters: z.object({ id: z.string() }),
    execute: async (args) => {
      if (args.id !== "known") {
        throw new AppError({ code: "secret.not_found", message: "not found", kind: "not_found" });
      }
      return { id: args.id, value: "42" };
    },
  },
];

const FAKE_DOMAIN: AssistantDomainConfig = {
  domainKey: "coretest",
  buildSystemPrompt: () => "You are a test assistant with no business domain.",
};

const FAKE_SCOPE: ScopeGuardConfig = {
  inScopePatterns: [],
  metaPatterns: [],
  outOfScopePatterns: [],
  classifierPrompt: "unused — scopeEnforcement is off in this suite",
  outOfScopeReply: () => "out of scope",
};

function fakeConfig(overrides: Partial<AssistantConfig> = {}): AssistantConfig {
  return {
    provider: "groq",
    model: "test-model",
    baseUrl: "http://localhost",
    apiKey: "test-key",
    requestTimeoutMs: 1000,
    maxToolIterations: 6,
    maxHistoryMessages: 24,
    maxOutputTokens: 500,
    scopeEnforcement: "off",
    enabled: true,
    ...overrides,
  };
}

suite("core/assistant — generic pipeline security invariant", () => {
  let app: TestingModule;
  const ai = new ScriptedAiClient();

  let orgA: string;
  let orgB: string;
  let userA: string; // org A, granted read:secret_thing
  let userNoPerm: string; // org A, no assistant-domain permissions at all

  const svc = () => get<AssistantService>(app, AssistantService);
  const registry = () => get<ToolRegistry>(app, ToolRegistry);

  beforeAll(async () => {
    applyTestConfig();
    await resetSchema();
    await migrateToLatest(TEST_DATABASE_URL);

    app = await Test.createTestingModule({
      imports: [AppModule, RbacModule, OrganizationsModule, AuditModule, IdentityModule],
      providers: [
        { provide: ASSISTANT_TOOLS, useValue: FAKE_TOOLS },
        { provide: ASSISTANT_DOMAIN_CONFIG, useValue: FAKE_DOMAIN },
        { provide: SCOPE_GUARD_CONFIG, useValue: FAKE_SCOPE },
        { provide: AI_CLIENT, useValue: ai },
        { provide: ASSISTANT_CONFIG, useValue: fakeConfig() },
        ToolRegistry,
        ScopeGuard,
        ConversationRepository,
        AssistantService,
      ],
    })
      .overrideProvider(WORKER_AUTOSTART)
      .useValue(false)
      .compile();
    await app.init();
    await get(app, SeedService).seed();

    const id = get(app, IdentityService);
    const orgs = get(app, OrganizationService);
    const rbac = get(app, RbacService);

    userA = (await id.register({ email: `a+${Date.now()}@core-assistant.test`, password: "correct horse battery" })).id;
    const adminA = (await id.register({ email: `admin-a+${Date.now()}@core-assistant.test`, password: "correct horse battery" })).id;
    userNoPerm = (await id.register({ email: `noperm+${Date.now()}@core-assistant.test`, password: "correct horse battery" })).id;
    const adminB = (await id.register({ email: `admin-b+${Date.now()}@core-assistant.test`, password: "correct horse battery" })).id;

    orgA = (await orgs.createOrganization({ name: "Org A", createdBy: adminA })).id;
    orgB = (await orgs.createOrganization({ name: "Org B", createdBy: adminB })).id;

    await asUser(adminA, orgA, () =>
      orgs.addMember({ organizationId: orgA, userId: userA, actorId: adminA }),
    );
    await asUser(adminA, orgA, () =>
      orgs.addMember({ organizationId: orgA, userId: userNoPerm, actorId: adminA }),
    );
    await asUser(adminA, orgA, () => rbac.createRole({ key: "secret_reader", name: "Secret reader" }));
    await asUser(adminA, orgA, () => rbac.grantPermission("secret_reader", "read", "secret_thing"));
    await asUser(adminA, orgA, () => rbac.assignRole(userA, "secret_reader", adminA));
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    ai.script();
  });

  // ── RBAC — the tool's own permission is enforced per call, in the tenant ──
  it("a tool with no permission requirement runs for anyone", async () => {
    const result = await asUser(userNoPerm, orgA, () =>
      registry().run("ping", "{}", {
        userId: userNoPerm,
        organizationId: orgA,
        locale: "en",
        correlationId: "t",
      }),
    );
    expect(result).toMatchObject({ ok: true, data: { pong: true } });
  });

  it("a permissioned tool is denied without the underlying permission", async () => {
    const result = await asUser(userNoPerm, orgA, () =>
      registry().run("get_secret", JSON.stringify({ id: "known" }), {
        userId: userNoPerm,
        organizationId: orgA,
        locale: "en",
        correlationId: "t",
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "auth.forbidden" } });
  });

  it("a permissioned tool succeeds once the underlying permission is granted (control)", async () => {
    const result = await asUser(userA, orgA, () =>
      registry().run("get_secret", JSON.stringify({ id: "known" }), {
        userId: userA,
        organizationId: orgA,
        locale: "en",
        correlationId: "t",
      }),
    );
    expect(result).toMatchObject({ ok: true, data: { id: "known", value: "42" } });
  });

  // ── No database / arbitrary-tool pathway ──────────────────────────────
  it("an unknown tool name is refused, whatever the model asked for", async () => {
    const result = await asUser(userA, orgA, () =>
      registry().run("execute_sql", '{"q":"DROP TABLE users;"}', {
        userId: userA,
        organizationId: orgA,
        locale: "en",
        correlationId: "t",
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "assistant.unknown_tool" } });
  });

  it("malformed tool arguments never reach execute()", async () => {
    const result = await asUser(userA, orgA, () =>
      registry().run("get_secret", "not json at all", {
        userId: userA,
        organizationId: orgA,
        locale: "en",
        correlationId: "t",
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "assistant.bad_tool_arguments" } });
  });

  // ── Conversation isolation ────────────────────────────────────────────
  it("a conversation is private to its owning organization", async () => {
    ai.script(say("hi from org A"));
    const { conversationId } = await asUser(userA, orgA, () =>
      svc().chat({ userId: userA, organizationId: orgA, locale: "en", message: "hello" }),
    );

    ai.script(say("leak?"));
    await expect(
      asUser(userA, orgB, () =>
        svc().chat({
          userId: userA,
          organizationId: orgB,
          locale: "en",
          message: "what did we say",
          conversationId,
        }),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("a conversation is private to its owning user, within the same tenant", async () => {
    ai.script(say("hi"));
    const { conversationId } = await asUser(userA, orgA, () =>
      svc().chat({ userId: userA, organizationId: orgA, locale: "en", message: "hello" }),
    );

    ai.script(say("nope"));
    await expect(
      asUser(userNoPerm, orgA, () =>
        svc().chat({
          userId: userNoPerm,
          organizationId: orgA,
          locale: "en",
          message: "continue",
          conversationId,
        }),
      ),
    ).rejects.toThrow(/not found/i);
    await expect(
      asUser(userNoPerm, orgA, () => svc().getConversation(userNoPerm, orgA, conversationId)),
    ).rejects.toThrow(/not found/i);
  });

  it("refuses a chat with no active organization", async () => {
    await expect(
      asUser(userA, null, () =>
        svc().chat({ userId: userA, organizationId: null, locale: "en", message: "hi" }),
      ),
    ).rejects.toMatchObject({ code: "assistant.no_organization" });
  });

  // ── The agent loop actually drives the fake tools end to end ─────────
  it("runs a permitted tool through the full chat loop and returns its result", async () => {
    ai.script(callTool("get_secret", { id: "known" }), say("The value is 42."));
    const res = await asUser(userA, orgA, () =>
      svc().chat({ userId: userA, organizationId: orgA, locale: "en", message: "what is the secret?" }),
    );
    expect(res.toolActivity).toContainEqual(
      expect.objectContaining({ name: "get_secret", ok: true }),
    );
    expect(res.message).toContain("42");
  });
});
