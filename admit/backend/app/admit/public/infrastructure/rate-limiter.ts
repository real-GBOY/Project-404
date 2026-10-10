import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { admitDb } from "@admit/admit/db/executor.js";

export interface RatePolicy {
  /** Distinguishes counters: "public:book", "public:search", … */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counters in Postgres: one atomic upsert per request, so every API instance
 * shares the same count (an in-memory limiter would give each instance its own). Runs on the
 * system connection — these counters aren't tenant data.
 */
@Injectable()
export class RateLimiter {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async hit(policy: RatePolicy, subject: string): Promise<RateDecision> {
    const now = this.clock.now().getTime();
    const windowMs = policy.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    const bucket = `${policy.name}:${subject}`;
    const row = await runAsSystem(() =>
      this.uow.transaction(() =>
        admitDb()
          .insertInto("admit_rate_limits")
          .values({ bucket, window_start: windowStart, hits: 1 })
          .onConflict((oc) => oc.columns(["bucket", "window_start"]).doUpdateSet({ hits: sql`admit_rate_limits.hits + 1` }))
          .returning("hits")
          .executeTakeFirstOrThrow(),
      ),
    );
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
    return {
      allowed: row.hits <= policy.limit,
      remaining: Math.max(policy.limit - row.hits, 0),
      retryAfterSeconds,
    };
  }

  /** Drop windows older than a day (the scheduled jobs call this). */
  async prune(): Promise<void> {
    const cutoff = new Date(this.clock.now().getTime() - 86_400_000);
    await runAsSystem(() => this.uow.transaction(() => admitDb().deleteFrom("admit_rate_limits").where("window_start", "<", cutoff).execute()));
  }
}
