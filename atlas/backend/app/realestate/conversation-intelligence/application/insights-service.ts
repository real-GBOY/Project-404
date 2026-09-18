import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, MESSAGING_PROVIDER, PERMISSION_PROVIDER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger, IMessagingProvider, IPermissionProvider } from "@core/contracts/index.js";
import type { ConversationDto } from "@core/index.js";
import { FollowupsService } from "@atlas/realestate/crm/application/followups-service.js";
import { LeadsRepository, type LeadRow } from "@atlas/realestate/crm/infrastructure/leads-repository.js";
import { LeadIntelligenceService } from "@atlas/realestate/lead-intelligence/application/lead-intelligence-service.js";
import { leadRequirementsSchema } from "@atlas/realestate/lead-intelligence/domain/requirements.schema.js";
import type { ConversationInsightsDto } from "../contracts/insights-types.js";
import { ConversationAiStateRepository } from "../infrastructure/ai-state-repository.js";
import { ConversationAnalysisRequester } from "./analysis-requester.js";
import { ConversationInsightsReader } from "./insights-reader.js";
import type { CreateFollowupBody } from "../validation/schemas.js";

/**
 * What a user can DO with a conversation's insights. Every operation:
 *   1. proves conversation membership first (Core messaging: non-members and other
 *      tenants get "not found"),
 *   2. requires the permission for the CRM change it makes, on top of the coarse
 *      `apply:conversation_insight` — the AI's suggestion never widens what the
 *      user may do,
 *   3. is an explicit request by a person (nothing here fires on its own),
 *   4. goes through the existing Atlas services, so validation and audit are the same
 *      as if the agent had made the change by hand.
 */
@Injectable()
export class ConversationInsightsService {
  constructor(
    private readonly reader: ConversationInsightsReader,
    private readonly state: ConversationAiStateRepository,
    private readonly requester: ConversationAnalysisRequester,
    private readonly leads: LeadsRepository,
    private readonly followups: FollowupsService,
    private readonly leadIntelligence: LeadIntelligenceService,
    @Inject(MESSAGING_PROVIDER) private readonly messaging: IMessagingProvider,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  get(actorId: string, conversationId: string): Promise<ConversationInsightsDto> {
    return this.reader.get(actorId, conversationId);
  }

  /** Ask for a fresh analysis. Returns immediately; the result arrives over the socket. */
  async refresh(actorId: string, conversationId: string): Promise<ConversationInsightsDto> {
    await this.messaging.getConversation(actorId, conversationId); // membership
    await this.requester.request(conversationId, "manual");
    return this.reader.get(actorId, conversationId);
  }

  /** "Apply to Lead" — replaces the lead's requirement profile with the conversation's, explicitly and audited. */
  async applyRequirements(actorId: string, conversationId: string, leadId?: string): Promise<LeadRow> {
    const conversation = await this.messaging.getConversation(actorId, conversationId);
    const targetLeadId = this.resolveLead(conversation, leadId);
    await this.requirePermission(actorId, "update", "lead");

    const row = await readInTenant(() => this.state.find(conversationId));
    const parsed = row?.extractedRequirements ? leadRequirementsSchema.safeParse(row.extractedRequirements) : null;
    if (!parsed?.success) {
      throw Conflict("conversation_intelligence.no_requirements", "This conversation has no extracted requirements yet.");
    }
    return this.leadIntelligence.applyRequirements(targetLeadId, parsed.data, actorId, { conversationId });
  }

  /** "Create follow-up" from an action item — text and due date are the user's. */
  async createFollowup(actorId: string, conversationId: string, body: CreateFollowupBody) {
    const conversation = await this.messaging.getConversation(actorId, conversationId);
    const leadId = this.resolveLead(conversation, body.leadId);
    await this.requirePermission(actorId, "create", "followup");

    const lead = await readInTenant(() => this.leads.findById(leadId));
    if (!lead) throw NotFound("lead.not_found", "Lead not found.");

    return this.uow.transaction(async () => {
      const followup = await this.followups.create({
        leadId,
        reason: body.reason,
        dueAt: body.dueAt,
        priority: body.priority,
        agentId: actorId,
      });
      await this.audit.record({
        actorId,
        action: "realestate.followup.created_from_conversation",
        resourceType: "realestate_followup",
        resourceId: followup.id,
        metadata: { conversationId, leadId },
      });
      return followup;
    });
  }

  /** The lead is the conversation's subject, or the explicit `leadId` — never both disagreeing. */
  private resolveLead(conversation: ConversationDto, explicit: string | undefined): string {
    const fromSubject = conversation.subjectType === "lead" ? conversation.subjectId : null;
    if (fromSubject && explicit && explicit !== fromSubject) {
      throw ValidationError("conversation_intelligence.lead_mismatch", "This conversation is about a different lead.");
    }
    const leadId = fromSubject ?? explicit;
    if (!leadId) {
      throw ValidationError("conversation_intelligence.lead_required", "Say which lead this is for — the conversation is not linked to one.");
    }
    return leadId;
  }

  private async requirePermission(actorId: string, action: string, resource: string): Promise<void> {
    const ok = await readInTenant(() => this.permissions.can(actorId, action, resource));
    if (!ok) throw Forbidden("auth.forbidden", `Missing permission: ${action}:${resource}`);
  }
}
