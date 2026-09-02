import { Injectable } from "@nestjs/common";
import type { DomainEvent } from "@core/contracts/domain-event.js";

/**
 * Event subscription registry (§6.1).
 *
 * Two kinds of subscriber, and the distinction must not be blurred:
 *
 *  - in-process: handler only touches the database. Runs synchronously inside
 *    the publisher's transaction, so it commits or rolls back with the
 *    originating change. No extra machinery.
 *
 *  - external: handler causes a side effect OUTSIDE the database (email, SMS,
 *    e-invoice submission, webhook, payment gateway). Routed through the
 *    transactional outbox and delivered by the worker with retries + DLQ.
 *    Given a name so failures are traceable per handler.
 */
export type EventHandler = (event: DomainEvent) => Promise<void>;

interface ExternalSubscription {
  handlerName: string;
  handle: EventHandler;
}

@Injectable()
export class EventRegistry {
  private readonly inProcess = new Map<string, EventHandler[]>();
  private readonly external = new Map<string, ExternalSubscription[]>();

  onInProcess(eventName: string, handler: EventHandler): void {
    const list = this.inProcess.get(eventName) ?? [];
    list.push(handler);
    this.inProcess.set(eventName, list);
  }

  onExternal(eventName: string, handlerName: string, handler: EventHandler): void {
    const list = this.external.get(eventName) ?? [];
    if (list.some((s) => s.handlerName === handlerName)) {
      throw new Error(`External handler "${handlerName}" already registered for "${eventName}".`);
    }
    list.push({ handlerName, handle: handler });
    this.external.set(eventName, list);
  }

  inProcessHandlers(eventName: string): EventHandler[] {
    return this.inProcess.get(eventName) ?? [];
  }

  externalHandlers(eventName: string): ExternalSubscription[] {
    return this.external.get(eventName) ?? [];
  }

  hasExternal(eventName: string): boolean {
    return (this.external.get(eventName)?.length ?? 0) > 0;
  }

  /** Test/reset helper. */
  clear(): void {
    this.inProcess.clear();
    this.external.clear();
  }
}
