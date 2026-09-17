import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { guardResponse } from "@core/index.js";
import { getContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { LeadsRepository, type LeadRow } from "@atlas/realestate/crm/infrastructure/leads-repository.js";
import { UnitsRepository } from "@atlas/realestate/properties/infrastructure/units-repository.js";
import { ProjectsRepository } from "@atlas/realestate/properties/infrastructure/projects-repository.js";
import { BuildingsRepository } from "@atlas/realestate/properties/infrastructure/buildings-repository.js";
import { StructuredAi } from "./structured-ai.js";
import {
  buildDeterministicExplanation,
  buildDeterministicMessage,
  buildExplanationPrompt,
  buildExtractionPrompt,
  explanationResponseSchema,
  extractionResponseSchema,
} from "./prompts.js";
import { leadRequirementsSchema, type LeadRequirements } from "../domain/requirements.schema.js";
import { matchUnitsToRequirements, type UnitMatchResult } from "../domain/lead-matching.domain.js";
import { recommendNextAction, type NextAction } from "../domain/next-action.domain.js";

const log = moduleLogger("lead-intelligence");

export interface LeadIntelligenceBrief {
  requirements: LeadRequirements;
  requirementsNotes: string | null;
  requirementsExtractedAt: string | null;
  matches: UnitMatchResult[];
  nextAction: NextAction;
  explanation: string;
  suggestedMessage: string;
  /** false when the AI explanation call failed/was unavailable and the
   *  explanation/message below are the deterministic fallback templates. */
  aiGenerated: boolean;
}

/** A crude but sufficient signal for which language to draft the client
 *  message in — the client's own words matter more than the UI locale. */
function detectScriptLocale(text: string): "ar" | "en" {
  return /[؀-ۿ]/.test(text) ? "ar" : "en";
}

/**
 * Atlas AI Lead Intelligence & Property Matching — orchestrates the pipeline
 * described in the module README: AI requirement extraction (untrusted,
 * validated) -> deterministic matching (`lead-matching.domain.ts`, the only
 * authority on which units are a fit) -> deterministic next action
 * (`next-action.domain.ts`) -> AI explanation (best-effort, never gates the
 * result). Depends on other domains' REPOSITORIES only, not their services —
 * same rule `DashboardService` follows — since this composes reads across
 * CRM + Properties without owning a table of its own (besides the three
 * columns added to `realestate_leads`).
 */
@Injectable()
export class LeadIntelligenceService {
  constructor(
    private readonly leads: LeadsRepository,
    private readonly units: UnitsRepository,
    private readonly projects: ProjectsRepository,
    private readonly buildings: BuildingsRepository,
    private readonly ai: StructuredAi,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /**
   * Step 1: AI turns free-text notes into a structured requirement profile,
   * persisted on the lead. The AI's only output here is DATA (validated
   * against `leadRequirementsSchema`) — it never touches a unit, a price, or
   * a match; that happens entirely in step 2 below.
   */
  async extractRequirements(leadId: string, notes: string, actorId: string): Promise<LeadRow> {
    const existing = await readInTenant(() => this.leads.findById(leadId));
    if (!existing) throw NotFound("lead.not_found", "Lead not found.");

    const trimmed = notes.trim();
    const { systemPrompt, userPrompt } = buildExtractionPrompt(trimmed);
    const requirements = await this.ai.completeJson({
      systemPrompt,
      userPrompt,
      schema: extractionResponseSchema,
      failureCode: "lead_intelligence.extraction_failed",
    });

    const now = this.clock.now();
    return this.uow.transaction(async () => {
      const updated = await this.leads.setRequirements(leadId, { notes: trimmed, requirements, extractedAt: now });
      // Notes may contain client PII/free text — never in the audit trail,
      // only the AI's own short, non-identifying summary (§18).
      await this.audit.record({
        actorId,
        action: "realestate.lead.requirements_extracted",
        resourceType: "realestate_lead",
        resourceId: leadId,
        after: { summary: requirements.summary, intent: requirements.intent },
      });
      return updated!;
    });
  }

  /**
   * Step 2-4: deterministic matching + next action, then a best-effort AI
   * explanation/draft message over exactly that (already-computed,
   * already-authorized) result. Requires step 1 to have run at least once.
   */
  async getBrief(leadId: string, actorId: string): Promise<LeadIntelligenceBrief> {
    const lead = await readInTenant(() => this.leads.findById(leadId));
    if (!lead) throw NotFound("lead.not_found", "Lead not found.");
    if (!lead.requirements) {
      throw ValidationError(
        "lead_intelligence.no_requirements",
        "Extract this lead's requirements before generating a sales brief.",
      );
    }
    const requirements = leadRequirementsSchema.parse(lead.requirements);

    const [unitRows, projectRows, buildingRows] = await readInTenant(() =>
      Promise.all([this.units.list({}), this.projects.list({}), this.buildings.listForProject({})]),
    );
    const now = this.clock.now();
    const matches = matchUnitsToRequirements(
      unitRows.map((u) => ({
        id: u.id,
        code: u.code,
        projectId: u.projectId,
        buildingId: u.buildingId,
        unitType: u.unitType,
        floor: u.floor,
        areaSqm: Number(u.areaSqm),
        basePriceEgp: u.basePriceEgp,
        status: u.status,
      })),
      projectRows.map((p) => ({ id: p.id, name: p.name, location: p.location })),
      buildingRows.map((b) => ({ id: b.id, handoverDate: b.handoverDate, status: b.status })),
      requirements,
      now,
      10,
    );

    const nextAction = recommendNextAction({
      leadStatus: lead.status,
      requirementsExtracted: true,
      hasBudget: requirements.budgetMinEgp !== null || requirements.budgetMaxEgp !== null,
      matches,
    });

    const correlationId = getContext()?.correlationId ?? "internal";
    let explanation: string;
    let suggestedMessage: string;
    let aiGenerated = true;
    try {
      const locale = detectScriptLocale(`${requirements.summary} ${lead.requirementsNotes ?? ""}`);
      const { systemPrompt, userPrompt } = buildExplanationPrompt({
        leadName: lead.name,
        locale,
        requirements,
        topMatches: matches.slice(0, 5),
        nextAction,
      });
      const result = await this.ai.completeJson({
        systemPrompt,
        userPrompt,
        schema: explanationResponseSchema,
        failureCode: "lead_intelligence.explanation_failed",
      });
      explanation = guardResponse(result.explanation, correlationId).text;
      suggestedMessage = guardResponse(result.suggestedMessage, correlationId).text;
    } catch (err) {
      aiGenerated = false;
      explanation = buildDeterministicExplanation(matches, nextAction);
      suggestedMessage = buildDeterministicMessage(lead.name, matches, requirements);
      log.warn(
        { correlationId, err: err instanceof Error ? err.message : String(err) },
        "lead-intelligence: AI explanation unavailable, used deterministic fallback",
      );
    }

    await this.uow.transaction(() =>
      this.audit.record({
        actorId,
        action: "realestate.lead.sales_brief_generated",
        resourceType: "realestate_lead",
        resourceId: leadId,
        metadata: { topScore: matches[0]?.score ?? null, matchCount: matches.length, aiGenerated, correlationId },
      }),
    );

    return {
      requirements,
      requirementsNotes: lead.requirementsNotes,
      requirementsExtractedAt: lead.requirementsExtractedAt?.toISOString() ?? null,
      matches,
      nextAction,
      explanation,
      suggestedMessage,
      aiGenerated,
    };
  }
}
