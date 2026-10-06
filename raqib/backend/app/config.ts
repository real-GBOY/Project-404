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
  /**
   * A deliberate second key for a dedicated showcase deployment: lets `RAQIB_SEED_DEMO=true` run with NODE_ENV=production.
   * Without it production refuses to seed, so the demo company can never appear next to real data by accident.
   */
  allowDemoInProduction: z
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
  /** Run Chromium with --no-sandbox (needed in some containers). The sandbox is on by default unless the process is root. */
  chromiumNoSandbox: z
    .enum(["true", "false", ""])
    .default("")
    .transform((v) => v === "true"),
  /** Public account requests accepted per client address per hour. */
  accountRequestsPerHour: z.coerce.number().int().min(1).max(1000).default(5),
  trustedProxyHops: z.coerce.number().int().min(0).max(5).default(0),
  /** Master key for field encryption (national IDs, second-factor secrets): 32 random bytes, base64. Required in production. */
  dataKey: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64 encoded"),
  /**
   * Refuse everything except account set-up routes to people whose organization requires a second factor they have not
   * enrolled, or whose password is past its rotation age. Defaults on in production, off elsewhere.
   */
  enforceAccountPolicy: z.enum(["true", "false", ""]).default(""),
  /** How long a locked account stays locked after too many wrong passwords. */
  lockoutMinutes: z.coerce.number().int().min(1).max(1440).default(15),
  /** Report PDFs: renders running at once, renders allowed to wait, and the time one render may take. */
  /**
   * Where report PDFs are rendered. `auto` (default): a local Chromium when `RAQIB_CHROMIUM_PATH` is set, otherwise Cloudflare
   * Browser Rendering when its credentials are set, otherwise PDFs are unavailable. `chromium` / `cloudflare` force one.
   */
  pdfDriver: z.enum(["auto", "chromium", "cloudflare"]).default("auto"),
  /** Cloudflare account and an API token with "Browser Rendering: Edit", for the `cloudflare` PDF driver. */
  cfAccountId: z.string().trim().default(""),
  cfApiToken: z.string().trim().default(""),
  pdfConcurrency: z.coerce.number().int().min(1).max(8).default(2),
  pdfQueueMax: z.coerce.number().int().min(0).max(200).default(20),
  pdfTimeoutMs: z.coerce.number().int().min(5_000).max(300_000).default(45_000),
  /** Optional ClamAV daemon (clamd) every uploaded evidence file is scanned by. Empty host = scanning off. */
  clamavHost: z.string().trim().default(""),
  clamavPort: z.coerce.number().int().min(1).max(65535).default(3310),
  /** Bearer token that protects GET /api/metrics. Empty = the endpoint answers 404. */
  metricsToken: z.string().trim().default(""),
  /** Optional URL that receives a JSON POST for server errors and failed jobs (Slack/Teams/PagerDuty-compatible webhook). */
  alertWebhookUrl: z.string().trim().default(""),
  /** Days a decided account request keeps its personal details before they are erased. */
  accountRequestRetentionDays: z.coerce.number().int().min(7).max(3650).default(180),
});

export type RaqibConfig = z.infer<typeof schema>;

export function readRaqibConfig(env: NodeJS.ProcessEnv = process.env): RaqibConfig {
  const parsed = schema.safeParse({
    seedDemo: env.RAQIB_SEED_DEMO,
    allowDemoInProduction: env.RAQIB_ALLOW_DEMO_IN_PRODUCTION,
    demoHistoryDays: env.RAQIB_DEMO_HISTORY_DAYS,
    jobsIntervalMs: env.RAQIB_JOBS_INTERVAL_MS,
    chromiumPath: env.RAQIB_CHROMIUM_PATH,
    chromiumNoSandbox: env.RAQIB_CHROMIUM_NO_SANDBOX,
    accountRequestsPerHour: env.RAQIB_ACCOUNT_REQUESTS_PER_HOUR,
    trustedProxyHops: env.RAQIB_TRUSTED_PROXY_HOPS,
    dataKey: env.RAQIB_DATA_KEY,
    enforceAccountPolicy: env.RAQIB_ENFORCE_ACCOUNT_POLICY,
    lockoutMinutes: env.RAQIB_LOCKOUT_MINUTES,
    pdfDriver: env.RAQIB_PDF_DRIVER,
    cfAccountId: env.RAQIB_CF_ACCOUNT_ID,
    cfApiToken: env.RAQIB_CF_API_TOKEN,
    pdfConcurrency: env.RAQIB_PDF_CONCURRENCY,
    pdfQueueMax: env.RAQIB_PDF_QUEUE_MAX,
    pdfTimeoutMs: env.RAQIB_PDF_TIMEOUT_MS,
    clamavHost: env.RAQIB_CLAMAV_HOST,
    clamavPort: env.RAQIB_CLAMAV_PORT,
    metricsToken: env.RAQIB_METRICS_TOKEN,
    alertWebhookUrl: env.RAQIB_ALERT_WEBHOOK_URL,
    accountRequestRetentionDays: env.RAQIB_ACCOUNT_REQUEST_RETENTION_DAYS,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid Raqib configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Whether account-policy gating (second factor, password age) is switched on for this process. */
export function accountPolicyEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = readRaqibConfig(env).enforceAccountPolicy;
  return v === "" ? env.NODE_ENV === "production" : v === "true";
}

/** Why the demo company may not be seeded in this process, or null when it may. Production needs the explicit second key. */
export function demoSeedRefusal(cfg: Pick<RaqibConfig, "seedDemo" | "allowDemoInProduction">, nodeEnv: string): string | null {
  if (!cfg.seedDemo || nodeEnv !== "production" || cfg.allowDemoInProduction) return null;
  return "RAQIB_SEED_DEMO=true is refused in production: the demo organization must never be created next to real data. A dedicated showcase deployment can opt in with RAQIB_ALLOW_DEMO_IN_PRODUCTION=true.";
}

export type PdfDriver = "chromium" | "cloudflare";

/** The PDF backend this process will use, or null when none is configured. */
export function resolvePdfDriver(cfg: Pick<RaqibConfig, "pdfDriver" | "chromiumPath" | "cfAccountId" | "cfApiToken">): PdfDriver | null {
  const chromium = cfg.chromiumPath.length > 0;
  const cloudflare = cfg.cfAccountId.length > 0 && cfg.cfApiToken.length > 0;
  if (cfg.pdfDriver === "chromium") return chromium ? "chromium" : null;
  if (cfg.pdfDriver === "cloudflare") return cloudflare ? "cloudflare" : null;
  return chromium ? "chromium" : cloudflare ? "cloudflare" : null;
}
