import { Router } from "express";
import { sql } from "kysely";
import { getDb } from "../../kernel/db/db.js";
import { handler } from "../../http/handler.js";
import type { OutboxRepository } from "../../events/outbox/outbox-repository.js";
import type { OutboxWorker } from "../../events/outbox/outbox-worker.js";

export interface HealthDeps {
  outbox?: OutboxRepository;
  worker?: OutboxWorker;
  version: string;
}

/**
 * Health check (§7.12 start-here) plus outbox-worker monitoring — which §6.2
 * makes mandatory the moment the outbox exists, because the worker "can fail
 * quietly while events pile up".
 */
export function healthRoutes(deps: HealthDeps): Router {
  const r = Router();

  r.get(
    "/health",
    handler(async (_req, res) => {
      res.json({ status: "ok", version: deps.version, time: new Date().toISOString() });
    }),
  );

  r.get(
    "/health/ready",
    handler(async (_req, res) => {
      const checks: Record<string, { ok: boolean; detail?: unknown }> = {};

      try {
        await sql`select 1`.execute(getDb());
        checks.database = { ok: true };
      } catch (err) {
        checks.database = { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }

      if (deps.outbox && deps.worker) {
        try {
          const stats = await deps.outbox.stats();
          const wh = deps.worker.health();
          const backlogHealthy = stats.pending < 1000 && stats.deadLettered === 0;
          checks.outbox = {
            ok: wh.running && wh.lastError === null && backlogHealthy,
            detail: { ...stats, worker: wh },
          };
        } catch (err) {
          checks.outbox = { ok: false, detail: err instanceof Error ? err.message : String(err) };
        }
      }

      const ok = Object.values(checks).every((c) => c.ok);
      res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "degraded", checks });
    }),
  );

  return r;
}
