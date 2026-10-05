import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { WORKER_AUTOSTART } from "@core/kernel/tokens.js";
import { getPool } from "@core/kernel/db/pool.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { readRaqibConfig } from "@raqib/config.js";
import { AlertService } from "@raqib/raqib/observability/alerts.js";
import { RaqibJobs, type JobsReport } from "./raqib-jobs.js";

/** Postgres advisory-lock key: only the process holding it runs the scheduled jobs, so a second API process never repeats them. */
const LEADER_LOCK_KEY = 7_265_100_001;

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
  /** True once the interval timer is armed (false in tests, which call `tick()` themselves). */
  running = false;
  runs = 0;
  failures = 0;
  /** Ticks skipped because another process held the leader lock. */
  skipped = 0;

  constructor(
    private readonly jobs: RaqibJobs,
    private readonly alerts: AlertService,
    @Inject(WORKER_AUTOSTART) private readonly autostart: boolean,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.autostart) return;
    const every = readRaqibConfig().jobsIntervalMs;
    this.running = true;
    this.timer = setInterval(() => void this.tick(), every);
    log.info({ intervalMs: every }, "raqib jobs runner started");
    void this.tick();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.running = false;
    while (this.ticking) await new Promise((r) => setTimeout(r, 25));
  }

  async tick(): Promise<JobsReport | undefined> {
    if (this.ticking) return undefined;
    this.ticking = true;
    try {
      const report = await this.withLeaderLock(() => this.jobs.runAll());
      if (!report) {
        this.skipped += 1;
        this.lastRun = { at: new Date(), report: { organizations: 0, visitsMarkedOverdue: 0, actionsMarkedOverdue: 0, requestsErased: 0, evidencePurged: 0 } }; // alive, just not the leader
        return undefined;
      }
      this.runs += 1;
      this.lastRun = { at: new Date(), report };
      return report;
    } catch (err) {
      this.failures += 1;
      log.error({ err }, "raqib jobs tick failed");
      void this.alerts.notify("Scheduled jobs failed", { error: err instanceof Error ? err.message : String(err), consecutiveFailures: this.failures });
      return undefined;
    } finally {
      this.ticking = false;
    }
  }

  /** Run `fn` only if this process wins the advisory lock; the lock lives on a dedicated connection and is released after. */
  private async withLeaderLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    const client = await getPool("system").connect();
    try {
      const got = (await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LEADER_LOCK_KEY])).rows[0]!.ok;
      if (!got) return undefined;
      try {
        return await fn();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [LEADER_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }
}
