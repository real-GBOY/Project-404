/**
 * Atlas AI Lead Intelligence & Property Matching — service-level integration
 * tests against real Postgres (same convention as every other Atlas
 * integration suite — see tests/helpers.ts). Covers: AI extraction
 * (success/retry/failure/provider-down), deterministic matching against
 * real seeded inventory, the AI-unavailable fallback, tenant isolation, and
 * the `analyze:lead` permission grant.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createRealestateTestApp,
  get,
  hasTestDb,
  seedAgent,
  seedOrg,
  type SeededOrg,
} from "@atlas/realestate/tests/helpers.js";
import {
  AI_CLIENT,
  ASSISTANT_CONFIG,
  AiUpstreamError,
  PERMISSION_PROVIDER,
  assistantConfigFromAuricConfig,
  getConfig,
  type AssistantConfig,
  type IPermissionProvider,
} from "@core/index.js";
import { ScriptedAiClient, say } from "@atlas/realestate/assistant/tests/scripted-ai-client.js";
import { LeadsService } from "@atlas/realestate/crm/application/leads-service.js";
import { LeadsRepository } from "@atlas/realestate/crm/infrastructure/leads-repository.js";
import { ProjectsService } from "@atlas/realestate/properties/application/projects-service.js";
import { BuildingsService } from "@atlas/realestate/properties/application/buildings-service.js";
import { UnitsService } from "@atlas/realestate/properties/application/units-service.js";
import { LeadIntelligenceService } from "../application/lead-intelligence-service.js";

const suite = hasTestDb ? describe : describe.skip;

const VALID_EXTRACTION = {
  budgetMinEgp: 6_000_000,
  budgetMaxEgp: 7_500_000,
  locations: ["New Cairo"],
  propertyTypes: ["apartment"],
  bedroomsMin: 3,
  bedroomsMax: 3,
  preferredFloors: [],
  deliveryWithinMonths: null,
  otherPreferences: [],
  intent: "high",
  summary: "3BR apartment in New Cairo, 6-7.5M",
};

suite("realestate/lead-intelligence", () => {
  let app: TestingModule;
  const ai = new ScriptedAiClient();
  const cfg: AssistantConfig = assistantConfigFromAuricConfig(getConfig());

  let orgA: SeededOrg;
  let orgB: SeededOrg;
  let leadA: string;

  const svc = () => get<LeadIntelligenceService>(app, LeadIntelligenceService);

  beforeAll(async () => {
    app = await createRealestateTestApp({ overrides: [{ token: AI_CLIENT, value: ai }, { token: ASSISTANT_CONFIG, value: cfg }] });
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");

    await asUser(orgA.adminId, orgA.orgId, async () => {
      const lead = await get<LeadsService>(app, LeadsService).create(
        { name: "Ahmed Mostafa", phone: "+201009990001", source: "referral", agentId: orgA.adminId },
        orgA.adminId,
      );
      leadA = lead.id;

      const project = await get<ProjectsService>(app, ProjectsService).create(
        { name: "North Hills", location: "New Cairo · 5th Settlement", developer: "Atlas Developments" },
        orgA.adminId,
      );
      const building = await get<BuildingsService>(app, BuildingsService).create(
        { projectId: project.id, key: "A", name: "Building A", floors: 4, unitsPerFloor: 6 },
        orgA.adminId,
      );
      await get<UnitsService>(app, UnitsService).generateForBuilding(building.id, orgA.adminId);
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    ai.script();
  });

  describe("extractRequirements", () => {
    it("parses a valid model reply and persists it on the lead", async () => {
      ai.script(say(JSON.stringify(VALID_EXTRACTION)));
      const updated = await asUser(orgA.adminId, orgA.orgId, () =>
        svc().extractRequirements(leadA, "3BR apartment New Cairo 6-7.5M", orgA.adminId),
      );
      expect(updated.requirementsExtractedAt).not.toBeNull();
      expect(updated.requirementsNotes).toBe("3BR apartment New Cairo 6-7.5M");
      expect((updated.requirements as typeof VALID_EXTRACTION).budgetMinEgp).toBe(6_000_000);
    });

    it("handles mixed Arabic/English notes the same way — extraction doesn't branch on script", async () => {
      ai.script(say(JSON.stringify(VALID_EXTRACTION)));
      const updated = await asUser(orgA.adminId, orgA.orgId, () =>
        svc().extractRequirements(leadA, "عايز شقة في New Cairo حوالي 6 لـ 7.5 مليون، 3 bedrooms", orgA.adminId),
      );
      expect(updated.requirementsNotes).toContain("New Cairo");
    });

    it("retries once on a malformed reply, then succeeds", async () => {
      ai.script(say("not json at all"), say(JSON.stringify(VALID_EXTRACTION)));
      const before = ai.requests.length;
      const updated = await asUser(orgA.adminId, orgA.orgId, () => svc().extractRequirements(leadA, "notes", orgA.adminId));
      expect(updated.requirements).not.toBeNull();
      expect(ai.requests.length - before).toBe(2);
    });

    it("gives up cleanly after two malformed replies", async () => {
      ai.script(say("nope"), say("still nope"));
      await expect(asUser(orgA.adminId, orgA.orgId, () => svc().extractRequirements(leadA, "notes", orgA.adminId))).rejects.toThrow(
        /couldn't produce a usable answer/i,
      );
    });

    it("propagates an upstream provider failure without masking it", async () => {
      ai.fail(() => AiUpstreamError.unavailable());
      await expect(asUser(orgA.adminId, orgA.orgId, () => svc().extractRequirements(leadA, "notes", orgA.adminId))).rejects.toThrow(
        /temporarily unavailable/i,
      );
    });

    it("a lead that doesn't exist (or belongs to another org) is reported as not found", async () => {
      await expect(asUser(orgB.adminId, orgB.orgId, () => svc().extractRequirements(leadA, "notes", orgB.adminId))).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe("getBrief", () => {
    it("refuses to generate a brief before requirements have been extracted", async () => {
      const bareLead = await asUser(orgA.adminId, orgA.orgId, () =>
        get<LeadsService>(app, LeadsService).create({ name: "No Requirements Yet", phone: "+201009990002", source: "website", agentId: orgA.adminId }, orgA.adminId),
      );
      await expect(asUser(orgA.adminId, orgA.orgId, () => svc().getBrief(bareLead.id, orgA.adminId))).rejects.toThrow(
        /extract this lead's requirements/i,
      );
    });

    it("computes real, deterministic matches against seeded inventory and gets an AI explanation", async () => {
      ai.script(say(JSON.stringify(VALID_EXTRACTION)));
      await asUser(orgA.adminId, orgA.orgId, () => svc().extractRequirements(leadA, "3BR New Cairo 6-7.5M", orgA.adminId));

      ai.script(say(JSON.stringify({ explanation: "Great fit on budget and location.", suggestedMessage: "Hi Ahmed, we found a great match!" })));
      const brief = await asUser(orgA.adminId, orgA.orgId, () => svc().getBrief(leadA, orgA.adminId));

      expect(brief.aiGenerated).toBe(true);
      expect(brief.explanation).toContain("Great fit");
      expect(brief.nextAction.action).toBeTruthy();
      // Deterministic — every match is a real "available" unit from the seeded building.
      for (const m of brief.matches) {
        expect(m.score).toBeGreaterThanOrEqual(0);
        expect(m.score).toBeLessThanOrEqual(100);
      }
      for (let i = 1; i < brief.matches.length; i++) {
        expect(brief.matches[i - 1].score).toBeGreaterThanOrEqual(brief.matches[i].score);
      }
    });

    it("falls back to a deterministic explanation when the AI call fails — the brief never breaks", async () => {
      ai.script(say(JSON.stringify(VALID_EXTRACTION)));
      await asUser(orgA.adminId, orgA.orgId, () => svc().extractRequirements(leadA, "notes", orgA.adminId));

      ai.fail(() => AiUpstreamError.unavailable());
      const brief = await asUser(orgA.adminId, orgA.orgId, () => svc().getBrief(leadA, orgA.adminId));

      expect(brief.aiGenerated).toBe(false);
      expect(brief.explanation.length).toBeGreaterThan(0);
      expect(brief.suggestedMessage.length).toBeGreaterThan(0);
    });

    it("tenant isolation: org B cannot generate a brief for org A's lead", async () => {
      ai.script(say(JSON.stringify(VALID_EXTRACTION)));
      await asUser(orgA.adminId, orgA.orgId, () => svc().extractRequirements(leadA, "notes", orgA.adminId));
      await expect(asUser(orgB.adminId, orgB.orgId, () => svc().getBrief(leadA, orgB.adminId))).rejects.toThrow(/not found/i);
    });
  });

  describe("demo seeding path (LeadsRepository.setRequirementsNotes)", () => {
    it("records raw notes only — never a pre-computed structured result", async () => {
      const lead = await asUser(orgA.adminId, orgA.orgId, () =>
        get<LeadsService>(app, LeadsService).create({ name: "Demo Notes Lead", phone: "+201009990003", source: "referral", agentId: orgA.adminId }, orgA.adminId),
      );
      await asUser(orgA.adminId, orgA.orgId, () => get<LeadsRepository>(app, LeadsRepository).setRequirementsNotes(lead.id, "3BR New Cairo notes"));
      const fetched = await asUser(orgA.adminId, orgA.orgId, () => get<LeadsRepository>(app, LeadsRepository).findById(lead.id));
      expect(fetched!.requirementsNotes).toBe("3BR New Cairo notes");
      expect(fetched!.requirements).toBeNull();
      expect(fetched!.requirementsExtractedAt).toBeNull();
    });
  });

  describe("authorization — analyze:lead", () => {
    it("a sales agent (granted analyze:lead) is authorized", async () => {
      const agentId = await seedAgent(app, orgA, "sales_agent", "Agent");
      const allowed = await asUser(agentId, orgA.orgId, () =>
        get<IPermissionProvider>(app, PERMISSION_PROVIDER).can(agentId, "analyze", "lead"),
      );
      expect(allowed).toBe(true);
    });

    it("a read-only auditor (never granted analyze:lead) is not authorized", async () => {
      const readerId = await seedAgent(app, orgA, "read_only", "Reader");
      const allowed = await asUser(readerId, orgA.orgId, () =>
        get<IPermissionProvider>(app, PERMISSION_PROVIDER).can(readerId, "analyze", "lead"),
      );
      expect(allowed).toBe(false);
    });

    it("permission is scoped to the active organization — no org context means no permission", async () => {
      const agentId = await seedAgent(app, orgA, "sales_agent", "Agent");
      const allowed = await asUser(agentId, null, () =>
        get<IPermissionProvider>(app, PERMISSION_PROVIDER).can(agentId, "analyze", "lead"),
      );
      expect(allowed).toBe(false);
    });
  });
});
