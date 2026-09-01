import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { DomainEvent } from "../../contracts/domain-event.js";
import type { Clock } from "../../kernel/clock.js";
import type { AuricConfig } from "../../kernel/config.js";
import { CLOCK, CONFIG, WORKER_AUTOSTART } from "../../kernel/tokens.js";
import { moduleLogger } from "../../kernel/logging/logger.js";
import { runWithContext, runAsSystem } from "../../kernel/logging/context.js";
import { unitOfWork } from "../../kernel/db/db.js";
import { newId } from "../../kernel/id.js";
import { EventRegistry } from "../registry.js";
import { OutboxRepository, type OutboxRow } from "./outbox-repository.js";

const log = moduleLogger("outbox-worker");

export interface OutboxWorkerOptions {
  pollIntervalMs: number;
  batchSize: number;
  /** A processing row untouched for this long is considered abandoned. */
  staleLockMs?: number;
}

/**
 * The silent background process (§6.2). It MUST be monitored — it can fail
 * quietly while events pile up. `stats()` on the repository and the health
 * check surface its backlog.
 *
 * Starts on app bootstrap and stops on shutdown. Test module refs that
 * `.compile()` without `.init()` never bootstrap, so they drive `tick()`
 * by hand — the historical `startWorker: false`.
 */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private ticking = false;
  private lastTickAt: Date | undefined;
  private lastError: string | undefined;
  private readonly opts: OutboxWorkerOptions;

  constructor(
    private readonly registry: EventRegistry,
    private readonly outbox: OutboxRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) config: AuricConfig,
    @Inject(WORKER_AUTOSTART) private readonly autostart: boolean,
  ) {
    this.opts = { pollIntervalMs: config.outboxPollIntervalMs, batchSize: config.outboxBatchSize };
  }

  onApplicationBootstrap(): void {
    if (this.autostart) this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    log.info({ intervalMs: this.opts.pollIntervalMs }, "outbox worker started");
    this.timer = setInterval(() => void this.tick(), this.opts.pollIntervalMs);
    // Kick once immediately so tests and dev don't wait a full interval.
    void this.tick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // let an in-flight tick settle
    while (this.ticking) await new Promise((r) => setTimeout(r, 25));
  }

  health() {
    return {
      running: this.running,
      lastTickAt: this.lastTickAt?.toISOString() ?? null,
      lastError: this.lastError ?? null,
    };
  }

  /** Public so tests can drive the worker deterministically. */
  async tick(): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    let processed = 0;
    try {
      // The worker sweeps every tenant's rows — it runs on the `auric_system`
      // connection (BYPASSRLS). Each message's handlers then run back in that
      // message's own tenant context (§ docs/tenancy.md).
      await runAsSystem(async () => {
        const staleMs = this.opts.staleLockMs ?? 5 * 60 * 1000;
        await unitOfWork.transaction(() => this.outbox.releaseStale(staleMs));

        for (;;) {
          const batch = await unitOfWork.transaction(() =>
            this.outbox.claimDue(this.opts.batchSize),
          );
          if (batch.length === 0) break;
          for (const row of batch) {
            await this.deliver(row);
            processed++;
          }
          if (batch.length < this.opts.batchSize) break;
        }
      });
      this.lastError = undefined;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      log.error({ err }, "outbox tick failed");
    } finally {
      this.lastTickAt = this.clock.now();
      this.ticking = false;
    }
    return processed;
  }

  private async deliver(row: OutboxRow): Promise<void> {
    const correlationId =
      (typeof row.payload.__correlationId === "string" && row.payload.__correlationId) ||
      newId("evt");

    const handlers = this.registry.externalHandlers(row.event_name);
    const event = this.rehydrate(row);
    const attempt = row.attempts + 1;

    // Handlers run in the message's own tenant context, so any tenant-scoped
    // read/write they do lands in the right place (§ docs/tenancy.md). A
    // NULL-org message (system event) stays in system context.
    const runHandlers = () =>
      row.organization_id
        ? runWithContext({ correlationId, organizationId: row.organization_id }, async () => {
            for (const sub of handlers) await sub.handle(event);
          })
        : runWithContext({ correlationId, system: true }, async () => {
            for (const sub of handlers) await sub.handle(event);
          });

    // Claim-state transitions stay on the system connection (this method is
    // called from inside `runAsSystem`).
    try {
      await runHandlers();
      await unitOfWork.transaction(() => this.outbox.markDelivered(row.id));
      log.info({ event: row.event_name, id: row.id, attempt }, "outbox message delivered");
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (attempt >= row.max_attempts) {
        await unitOfWork.transaction(() => this.outbox.deadLetter(row, attempt, message));
        log.error(
          { event: row.event_name, id: row.id, attempt, err },
          "outbox message dead-lettered after exhausting retries",
        );
      } else {
        await unitOfWork.transaction(() => this.outbox.reschedule(row.id, attempt, message));
        log.warn({ event: row.event_name, id: row.id, attempt, err }, "outbox message rescheduled");
      }
    }
  }

  private rehydrate(row: OutboxRow): DomainEvent {
    const { __version, __occurredAt, __correlationId, ...payload } = row.payload as Record<
      string,
      unknown
    >;
    return {
      name: row.event_name,
      version: typeof __version === "number" ? __version : 1,
      payload,
      occurredAt: typeof __occurredAt === "string" ? new Date(__occurredAt) : this.clock.now(),
      correlationId: typeof __correlationId === "string" ? __correlationId : undefined,
    };
  }
}
