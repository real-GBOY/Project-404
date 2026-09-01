import { Module } from "@nestjs/common";
import { EVENT_BUS, WORKER_AUTOSTART } from "../kernel/tokens.js";
import { EventRegistry } from "./registry.js";
import { EventBus } from "./event-bus.js";
import { OutboxRepository } from "./outbox/outbox-repository.js";
import { OutboxWorker } from "./outbox/outbox-worker.js";

/**
 * The event system (§6): the in-process bus for DB-only handlers and the
 * transactional outbox + worker for external side effects. `EVENT_BUS` is the
 * `IEventBus` other modules publish through; `EventRegistry` is where they
 * register their subscribers (in `OnModuleInit`).
 */
@Module({
  providers: [
    EventRegistry,
    OutboxRepository,
    OutboxWorker,
    EventBus,
    { provide: EVENT_BUS, useExisting: EventBus },
    { provide: WORKER_AUTOSTART, useValue: true },
  ],
  exports: [EVENT_BUS, EventRegistry, OutboxRepository, OutboxWorker],
})
export class EventsModule {}
