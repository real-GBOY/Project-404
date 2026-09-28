import { Module } from "@nestjs/common";
import { EVENT_BUS, WORKER_AUTOSTART } from "@core/kernel/tokens.js";
import { EventRegistry } from "./registry.js";
import { EventBus } from "./event-bus.js";
import { OutboxRepository } from "@core/events/outbox/outbox-repository.js";
import { OutboxWorker } from "@core/events/outbox/outbox-worker.js";

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
  // WORKER_AUTOSTART is exported so product background workers share the outbox worker's
  // switch: on in the app, off in tests (which drive tick() by hand).
  exports: [EVENT_BUS, EventRegistry, OutboxRepository, OutboxWorker, WORKER_AUTOSTART],
})
export class EventsModule {}
