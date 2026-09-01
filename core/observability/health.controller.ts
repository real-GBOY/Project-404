import { Controller, Get, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { sql } from "kysely";
import { getDb, unitOfWork } from "../kernel/db/db.js";
import { runAsSystem } from "../kernel/logging/context.js";
import { CORE_VERSION } from "../version.js";
import { OutboxRepository } from "../events/outbox/outbox-repository.js";
import { OutboxWorker } from "../events/outbox/outbox-worker.js";

/**
 * Health + outbox-worker monitoring (§7.12, §6.2) — the worker "can fail
 * quietly while events pile up", so `/health/ready` returns 503 when it is
 * stopped, erroring, badly backed up, or has any dead-lettered message. The
 * backlog spans every tenant, so it is read on the system connection.
 */
@Controller("health")
export class HealthController {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly worker: OutboxWorker,
  ) {}

  @Get()
  health() {
    return { status: "ok", version: CORE_VERSION, time: new Date().toISOString() };
  }

  @Get("ready")
  async ready(@Res() reply: FastifyReply) {
    const checks: Record<string, { ok: boolean; detail?: unknown }> = {};

    try {
      await sql`select 1`.execute(getDb());
      checks.database = { ok: true };
    } catch (err) {
      checks.database = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }

    try {
      const stats = await runAsSystem(() => unitOfWork.transaction(() => this.outbox.stats()));
      const wh = this.worker.health();
      const backlogHealthy = stats.pending < 1000 && stats.deadLettered === 0;
      checks.outbox = {
        ok: wh.running && wh.lastError === null && backlogHealthy,
        detail: { ...stats, worker: wh },
      };
    } catch (err) {
      checks.outbox = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }

    const ok = Object.values(checks).every((c) => c.ok);
    reply.status(ok ? 200 : 503).send({ status: ok ? "ready" : "degraded", checks });
  }
}
