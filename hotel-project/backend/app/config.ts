import { z } from "zod";

/**
 * HotelOS's own configuration — the variables that only this product reads. Everything
 * Core-owned (database, JWT, files, mail, outbox, CORS) stays in `core/kernel/config.ts` under
 * its `AURIC_*` names; this file never duplicates any of it. Parsed with the same fail-fast
 * approach as Core's: a bad value throws at boot, not at first use.
 */
const schema = z.object({
  /** Seed the Hotel Transylvania demo property on boot. Never enable against real data. */
  seedDemo: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** How many days of past business the demo plays through the real workflows. */
  demoHistoryDays: z.coerce.number().int().min(1).max(365).default(120),
  /** How often the scheduled jobs (auto no-show, hold expiry) run. Default 15 minutes. */
  jobsIntervalMs: z.coerce.number().int().min(10_000).default(900_000),
  /**
   * How many reverse proxies sit in front of the API (e.g. 1 for nginx). The public API takes the
   * client's address from X-Forwarded-For only this many hops from the right — the entries our
   * own proxies appended — so a visitor can't spoof it to dodge rate limits. 0 = direct.
   */
  trustedProxyHops: z.coerce.number().int().min(0).max(5).default(0),
});

export type HotelConfig = z.infer<typeof schema>;

export function readHotelConfig(env: NodeJS.ProcessEnv = process.env): HotelConfig {
  const parsed = schema.safeParse({
    seedDemo: env.HOTEL_SEED_DEMO,
    demoHistoryDays: env.HOTEL_DEMO_HISTORY_DAYS,
    jobsIntervalMs: env.HOTEL_JOBS_INTERVAL_MS,
    trustedProxyHops: env.HOTEL_TRUSTED_PROXY_HOPS,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid HotelOS configuration:\n${issues}`);
  }
  return parsed.data;
}
