import { Inject, Injectable } from "@nestjs/common";
import type { DomainEvent } from "@core/contracts/domain-event.js";
import type { IEventBus } from "@core/contracts/index.js";
import type { Clock } from "@core/kernel/clock.js";
import { CLOCK } from "@core/kernel/tokens.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { getContext } from "@core/kernel/logging/context.js";
import { inTransaction } from "@core/kernel/db/db.js";
import { EventRegistry } from "./registry.js";
import { OutboxRepository } from "@core/events/outbox/outbox-repository.js";

const log = moduleLogger("events");

/**
 * The IEventBus implementation wired into every module.
 *
 * publish():
 *   1. runs in-process handlers now, on the caller's transaction — they
 *      commit or roll back with the originating change.
 *   2. if the event has any external subscriber, writes one outbox row on the
 *      same transaction. The worker delivers it later, with retries.
 *
 * The bus never opens a transaction. If an external-effect event is published
 * outside a transaction, that is a bug in the use case — we warn loudly.
 */
@Injectable()
export class EventBus implements IEventBus {
  constructor(
    private readonly registry: EventRegistry,
    private readonly outbox: OutboxRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    const enriched: DomainEvent = {
      ...event,
      occurredAt: event.occurredAt ?? this.clock.now(),
      correlationId: event.correlationId ?? getContext()?.correlationId,
    };

    const inProcess = this.registry.inProcessHandlers(enriched.name);
    for (const handler of inProcess) {
      // Errors propagate on purpose: a failed internal handler must roll the
      // whole transaction back.
      await handler(enriched);
    }

    if (this.registry.hasExternal(enriched.name)) {
      if (!inTransaction()) {
        log.warn(
          { event: enriched.name },
          "external-effect event published outside a transaction — outbox write is not atomic with business data",
        );
      }
      await this.outbox.enqueue(enriched);
    }

    log.debug(
      { event: enriched.name, inProcess: inProcess.length, external: this.registry.hasExternal(enriched.name) },
      "event published",
    );
  }
}
