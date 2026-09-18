import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IEventBus } from "@core/contracts/index.js";
import { OutboxWorker } from "@core/events/outbox/outbox-worker.js";
import { type AnalysisRequestReason, analysisRequested } from "../events/events.js";

/**
 * Asks for a (re-)analysis of a conversation — by publishing an outbox event,
 * never by calling the LLM. The request path stays a single cheap insert; the
 * analysis runs later, off the request, from the outbox worker.
 */
@Injectable()
export class ConversationAnalysisRequester {
  constructor(
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWorker,
  ) {}

  /** Publish on the caller's transaction (used by the in-process message subscriber). */
  publish(conversationId: string, reason: AnalysisRequestReason): Promise<void> {
    return this.events.publish(
      analysisRequested({ organizationId: requireOrganizationId(), conversationId, reason }),
    );
  }

  /** Own transaction + post-commit nudge (used by the API and the Copilot tool). */
  async request(conversationId: string, reason: AnalysisRequestReason): Promise<void> {
    await this.uow.transaction(() => this.publish(conversationId, reason));
    this.outbox.nudge();
  }
}
