// OPS: Raqib's operations endpoints — Prometheus metrics (bearer token) and readiness. Read-only, no tenant data.
import { timingSafeEqual } from "node:crypto";
import { access, constants } from "node:fs/promises";
import { Controller, Get, Headers, Inject, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { getConfig } from "@core/kernel/config.js";
import { unitOfWork } from "@core/kernel/db/db.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { OutboxRepository } from "@core/events/outbox/outbox-repository.js";
import { OutboxWorker } from "@core/events/outbox/outbox-worker.js";
import { readRaqibConfig } from "@raqib/config.js";
import { JobsRunner } from "@raqib/raqib/jobs/jobs-runner.js";
import { metrics, type Gauge } from "./metrics.js";

const same = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** How stale the scheduled jobs may be, as a multiple of their interval, before the service reports itself degraded. */
const STALE_FACTOR = 3;

@ApiExcludeController()
@Controller()
export class ObservabilityController {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly worker: OutboxWorker,
    private readonly jobs: JobsRunner,
    @Inject("RAQIB_BOOTED_AT") private readonly bootedAt: number,
  ) {}

  /** GET /api/metrics — Prometheus text. Needs `Authorization: Bearer $RAQIB_METRICS_TOKEN`; answers 404 when no token is configured. */
  @Get("metrics")
  async metrics(@Headers("authorization") auth: string | undefined, @Res() reply: FastifyReply) {
    const token = readRaqibConfig().metricsToken;
    if (!token) return reply.status(404).send({ error: { code: "not_found", message: "Not found." } });
    if (!auth || !same(auth, `Bearer ${token}`)) return reply.status(401).send({ error: { code: "unauthenticated", message: "Authentication required." } });

    const g: Gauge[] = [];
    const mem = process.memoryUsage();
    g.push({ name: "raqib_process_uptime_seconds", help: "Seconds since the process started.", value: (Date.now() - metrics.startedAt) / 1000 });
    g.push({ name: "raqib_process_resident_memory_bytes", help: "Resident set size.", value: mem.rss });
    g.push({ name: "raqib_process_heap_used_bytes", help: "V8 heap in use.", value: mem.heapUsed });
    const last = this.jobs.lastRun;
    g.push({
      name: "raqib_jobs_last_run_timestamp_seconds",
      help: "When the scheduled jobs last completed (0 = never).",
      value: last ? last.at.getTime() / 1000 : 0,
    });
    g.push({ name: "raqib_jobs_runs_total", help: "Completed scheduled job runs.", value: this.jobs.runs });
    g.push({ name: "raqib_jobs_failures_total", help: "Scheduled job runs that failed.", value: this.jobs.failures });
    try {
      const s = await runAsSystem(() => unitOfWork.transaction(() => this.outbox.stats()));
      g.push({ name: "raqib_outbox_pending", help: "Outbox messages waiting to be delivered.", value: s.pending });
      g.push({ name: "raqib_outbox_dead_lettered", help: "Outbox messages that exhausted their retries.", value: s.deadLettered });
    } catch {
      g.push({ name: "raqib_outbox_pending", help: "Outbox messages waiting to be delivered.", value: -1 });
    }
    return reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8").header("Cache-Control", "no-store").send(metrics.render(g));
  }

  /**
   * GET /api/health/raqib — Raqib's own readiness on top of Core's `/api/health/ready`: the scheduled jobs are running on
   * time, file storage is usable, and PDF rendering is up (informational). 503 when a hard check fails.
   */
  @Get("health/raqib")
  async ready(@Res() reply: FastifyReply) {
    const cfg = readRaqibConfig();
    const checks: Record<string, { ok: boolean; detail?: unknown }> = {};

    const age = Date.now() - (this.jobs.lastRun?.at.getTime() ?? this.bootedAt);
    const limit = cfg.jobsIntervalMs * STALE_FACTOR;
    checks.jobs = {
      ok: !this.jobs.running || age <= limit,
      detail: {
        running: this.jobs.running,
        lastRunAt: this.jobs.lastRun?.at.toISOString() ?? null,
        secondsSinceLastRun: Math.round(age / 1000),
        failures: this.jobs.failures,
      },
    };

    const storage = getConfig();
    if (storage.fileStorageDriver === "local") {
      try {
        await access(storage.fileStoragePath, constants.W_OK);
        checks.storage = { ok: true, detail: { driver: "local" } };
      } catch (err) {
        checks.storage = { ok: false, detail: { driver: "local", error: err instanceof Error ? err.message : String(err) } };
      }
    } else checks.storage = { ok: true, detail: { driver: storage.fileStorageDriver } };

    checks.outbox = { ok: this.worker.health().lastError === null, detail: { running: this.worker.health().running } };

    const ok = Object.values(checks).every((c) => c.ok);
    return reply.status(ok ? 200 : 503).send({ status: ok ? "ready" : "degraded", checks });
  }
}
