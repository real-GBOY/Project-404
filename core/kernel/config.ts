import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

/**
 * Central configuration. Parsed once at startup; a bad environment fails fast
 * and loudly rather than surfacing as a mysterious runtime error later.
 */
const schema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  port: z.coerce.number().int().positive().default(3000),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // Migrations run as the schema owner (this URL). The runtime connects with
  // two lower-privilege roles: `auric_app` (no BYPASSRLS — every tenant-scoped
  // query is filtered by RLS) and `auric_system` (BYPASSRLS — signup, webhooks,
  // the outbox worker). Both default to `databaseUrl` so a single-role dev DB
  // still works; RLS is only actually enforced when they point at `auric_app` /
  // `auric_system`. See docs/tenancy.md.
  databaseUrl: z.string().url().default("postgres://postgres:postgres@localhost:5432/auric"),
  appDatabaseUrl: z.string().url().optional(),
  systemDatabaseUrl: z.string().url().optional(),

  jwtSecret: z.string().min(1).default("dev-only-insecure-change-me"),
  accessTokenTtl: z.coerce.number().int().positive().default(900),
  refreshTokenTtl: z.coerce.number().int().positive().default(2_592_000),

  defaultLocale: z.string().default("en"),
  supportedLocales: z
    .string()
    .default("ar,en")
    .transform((s: string) =>
      s
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean),
    ),

  // Browser origins allowed to call the API cross-site (comma-separated). Empty
  // (the default) leaves CORS off — the frontend is same-origin behind nginx.
  // An entry beginning `*.` is a suffix match (e.g. `*.vercel.app` for Vercel
  // preview deployments). See docs/deployment.md.
  corsOrigins: z
    .string()
    .default("")
    .transform((s: string) =>
      s
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean),
    ),

  // File storage. `local` writes to disk under `fileStoragePath`; `r2` talks to
  // a Cloudflare R2 bucket over its S3-compatible API (§ core/files/README.md).
  // The presigned-upload flow works on both — `local` presigns its own
  // authenticated loopback route, `r2` issues real S3 presigned URLs.
  fileStorageDriver: z.enum(["local", "r2"]).default("local"),
  fileStoragePath: z.string().default("./storage/files"),
  r2AccountId: z.string().optional(),
  r2AccessKeyId: z.string().optional(),
  r2SecretAccessKey: z.string().optional(),
  r2Bucket: z.string().optional(),
  r2Endpoint: z.string().url().optional(),
  r2PublicBaseUrl: z.string().url().optional(),
  /** TTL for a presigned upload/download URL, seconds. */
  filePresignTtlSeconds: z.coerce.number().int().positive().default(900),
  /** Hard cap on a single upload, bytes. Matches the multipart limit (25 MiB). */
  fileMaxUploadBytes: z.coerce.number().int().positive().default(26_214_400),
  /** Allowed upload MIME types (comma-separated). Empty = allow any. */
  fileAllowedMimeTypes: z
    .string()
    .default("")
    .transform((s: string) =>
      s
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean),
    ),

  mailFrom: z.string().default("no-reply@auric.local"),
  smtpUrl: z.string().optional(),
  appName: z.string().default("AURIC"),
  appUrl: z.string().url().default("http://localhost:3000"),

  outboxPollIntervalMs: z.coerce.number().int().positive().default(2000),
  outboxMaxAttempts: z.coerce.number().int().positive().default(5),
  outboxBatchSize: z.coerce.number().int().positive().default(20),

  // AI Copilot provider (core/assistant/README.md). Deliberately NOT
  // AURIC_-prefixed: these are the exact env var names already deployed for
  // Mizan Copilot's production config (docs/assistant.md) — renaming would
  // require an ops change on the live VPS for no benefit. A domain-specific
  // tool set, system prompt, and scope vocabulary are supplied by each
  // product's own assistant module, not by Core.
  aiProvider: z.enum(["groq", "openai"]).default("groq"),
  aiModel: z.string().min(1).default("openai/gpt-oss-120b"),
  aiBaseUrl: z.string().url().default("https://api.groq.com/openai/v1"),
  aiApiKey: z.string().default(""),
  /** Per upstream HTTP call, milliseconds. */
  aiRequestTimeoutMs: z.coerce.number().int().positive().default(45_000),
  /** Hard cap on agent-loop iterations (tool round-trips) before we stop. */
  aiMaxToolIterations: z.coerce.number().int().positive().max(20).default(6),
  /** Conversation turns sent upstream before the oldest are dropped. */
  aiMaxHistoryMessages: z.coerce.number().int().positive().default(24),
  /** Upper bound on assistant output tokens per turn. */
  aiMaxOutputTokens: z.coerce.number().int().positive().default(1500),
  /**
   * Keeps the assistant on the product's own domain.
   *   strict      — a pre-flight scope check refuses off-topic requests outright
   *   prompt_only — no pre-check; the system prompt is the only guard
   *   off         — no scope restriction
   */
  aiScopeEnforcement: z.enum(["strict", "prompt_only", "off"]).default("strict"),
});

export type AuricConfig = z.infer<typeof schema>;

function readEnv(): AuricConfig {
  const aiProvider = (process.env.AI_PROVIDER ?? "groq").toLowerCase();
  const aiApiKey =
    process.env.AI_API_KEY ??
    (aiProvider === "openai" ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY) ??
    "";

  const parsed = schema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.AURIC_PORT,
    logLevel: process.env.AURIC_LOG_LEVEL,
    databaseUrl: process.env.AURIC_DATABASE_URL,
    appDatabaseUrl: process.env.AURIC_APP_DATABASE_URL,
    systemDatabaseUrl: process.env.AURIC_SYSTEM_DATABASE_URL,
    jwtSecret: process.env.AURIC_JWT_SECRET,
    accessTokenTtl: process.env.AURIC_ACCESS_TOKEN_TTL,
    refreshTokenTtl: process.env.AURIC_REFRESH_TOKEN_TTL,
    corsOrigins: process.env.AURIC_CORS_ORIGINS,
    defaultLocale: process.env.AURIC_DEFAULT_LOCALE,
    supportedLocales: process.env.AURIC_SUPPORTED_LOCALES,
    fileStorageDriver: process.env.AURIC_FILE_STORAGE_DRIVER,
    fileStoragePath: process.env.AURIC_FILE_STORAGE_PATH,
    r2AccountId: process.env.AURIC_R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.AURIC_R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.AURIC_R2_SECRET_ACCESS_KEY,
    r2Bucket: process.env.AURIC_R2_BUCKET,
    r2Endpoint: process.env.AURIC_R2_ENDPOINT,
    r2PublicBaseUrl: process.env.AURIC_R2_PUBLIC_BASE_URL,
    filePresignTtlSeconds: process.env.AURIC_FILE_PRESIGN_TTL_SECONDS,
    fileMaxUploadBytes: process.env.AURIC_FILE_MAX_UPLOAD_BYTES,
    fileAllowedMimeTypes: process.env.AURIC_FILE_ALLOWED_MIME_TYPES,
    mailFrom: process.env.AURIC_MAIL_FROM,
    smtpUrl: process.env.AURIC_SMTP_URL,
    appName: process.env.AURIC_APP_NAME,
    appUrl: process.env.AURIC_APP_URL,
    outboxPollIntervalMs: process.env.AURIC_OUTBOX_POLL_INTERVAL_MS,
    outboxMaxAttempts: process.env.AURIC_OUTBOX_MAX_ATTEMPTS,
    outboxBatchSize: process.env.AURIC_OUTBOX_BATCH_SIZE,

    aiProvider,
    aiModel: process.env.AI_MODEL,
    aiBaseUrl:
      process.env.AI_BASE_URL ??
      (aiProvider === "openai" ? "https://api.openai.com/v1" : undefined),
    aiApiKey,
    aiRequestTimeoutMs: process.env.AI_REQUEST_TIMEOUT_MS,
    aiMaxToolIterations: process.env.AI_MAX_TOOL_ITERATIONS,
    aiMaxHistoryMessages: process.env.AI_MAX_HISTORY_MESSAGES,
    aiMaxOutputTokens: process.env.AI_MAX_OUTPUT_TOKENS,
    aiScopeEnforcement: process.env.AI_SCOPE_ENFORCEMENT,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid AURIC configuration:\n${issues}`);
  }

  const cfg = parsed.data;
  if (cfg.nodeEnv === "production" && cfg.jwtSecret === "dev-only-insecure-change-me") {
    throw new Error("AURIC_JWT_SECRET must be set to a real secret in production.");
  }
  if (cfg.fileStorageDriver === "r2") {
    const missing = (
      [
        ["AURIC_R2_ACCOUNT_ID", cfg.r2AccountId],
        ["AURIC_R2_ACCESS_KEY_ID", cfg.r2AccessKeyId],
        ["AURIC_R2_SECRET_ACCESS_KEY", cfg.r2SecretAccessKey],
        ["AURIC_R2_BUCKET", cfg.r2Bucket],
      ] as const
    )
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(`AURIC_FILE_STORAGE_DRIVER=r2 requires: ${missing.join(", ")}.`);
    }
  }
  // Fall back to the owner URL so a single-role dev/test DB still runs.
  cfg.appDatabaseUrl ??= cfg.databaseUrl;
  cfg.systemDatabaseUrl ??= cfg.databaseUrl;
  return cfg;
}

let cached: AuricConfig | undefined;

/** Returns the parsed config, reading the environment on first call. */
export function getConfig(): AuricConfig {
  cached ??= readEnv();
  return cached;
}

/** Test helper: override config values without touching process.env. */
export function setConfigForTests(overrides: Partial<AuricConfig>): void {
  cached = { ...getConfig(), ...overrides };
}
