import { z } from "zod";

/**
 * Raqib's own configuration — the variables that only this product reads. Everything
 * Core-owned (database, JWT, files, mail, outbox, CORS) stays in `core/kernel/config.ts` under
 * its `AURIC_*` names; this file never duplicates any of it. Parsed with the same fail-fast
 * approach as Core's: a bad value throws at boot, not at first use.
 */
const schema = z.object({
  /** Seed the demo organization (fictional guarding company) on boot. Never enable against real data. */
  seedDemo: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** How many days of past inspection history the demo seeds. */
  demoHistoryDays: z.coerce.number().int().min(1).max(365).default(365),
  /** How often the scheduled jobs (overdue visits and actions) run. Default 15 minutes. */
  jobsIntervalMs: z.coerce.number().int().min(10_000).default(900_000),
  /**
   * How many reverse proxies sit in front of the API (e.g. 1 for nginx). The public API takes the
   * client's address from X-Forwarded-For only this many hops from the right — the entries our
   * own proxies appended — so a visitor can't spoof it to dodge rate limits. 0 = direct.
   */
  /**
   * Path of the Chromium/Chrome executable used to render report PDFs (headless, via puppeteer-core). Empty = PDF
   * generation is unavailable and the API answers 503 `raqib.pdf_unavailable` instead of failing obscurely.
   */
  chromiumPath: z.string().trim().default(""),
  trustedProxyHops: z.coerce.number().int().min(0).max(5).default(0),
});

export type RaqibConfig = z.infer<typeof schema>;

export function readRaqibConfig(env: NodeJS.ProcessEnv = process.env): RaqibConfig {
  const parsed = schema.safeParse({
    seedDemo: env.RAQIB_SEED_DEMO,
    demoHistoryDays: env.RAQIB_DEMO_HISTORY_DAYS,
    jobsIntervalMs: env.RAQIB_JOBS_INTERVAL_MS,
    chromiumPath: env.RAQIB_CHROMIUM_PATH,
    trustedProxyHops: env.RAQIB_TRUSTED_PROXY_HOPS,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid Raqib configuration:\n${issues}`);
  }
  return parsed.data;
}
