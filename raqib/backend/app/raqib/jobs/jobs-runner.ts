import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { WORKER_AUTOSTART } from "@core/kernel/tokens.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { readRaqibConfig } from "@raqib/config.js";
import { RaqibJobs, type JobsReport } from "./raqib-jobs.js";

const log = moduleLogger("raqib-jobs-runner");

/**
 * Runs `RaqibJobs` on an interval — the same lifecycle as Core's outbox worker: it starts on app bootstrap and
 * stops on shutdown, and tests (which don't autostart workers) call `tick()`. A tick never overlaps the previous
 * one; a failing tick is logged and retried next interval.
 */
@Injectable()
export class JobsRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private ticking = false;
  lastRun: { at: Date; report: JobsReport } | undefined;

  constructor(
    private readonly jobs: RaqibJobs,
    @Inject(WORKER_AUTOSTART) private readonly autostart: boolean,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.autostart) return;
    const every = readRaqibConfig().jobsIntervalMs;
    this.timer = setInterval(() => void this.tick(), every);
    log.info({ intervalMs: every }, "raqib jobs runner started");
    void this.tick();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    while (this.ticking) await new Promise((r) => setTimeout(r, 25));
  }

  async tick(): Promise<JobsReport | undefined> {
    if (this.ticking) return undefined;
    this.ticking = true;
    try {
      const report = await this.jobs.runAll();
      this.lastRun = { at: new Date(), report };
      return report;
    } catch (err) {
      log.error({ err }, "raqib jobs tick failed");
      return undefined;
    } finally {
      this.ticking = false;
    }
  }
}
