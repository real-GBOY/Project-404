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

  defaultLocale: z.string().default("ar"),
  supportedLocales: z
    .string()
    .default("ar,en")
    .transform((s: string) =>
      s
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean),
    ),

  fileStorageDriver: z.enum(["local"]).default("local"),
  fileStoragePath: z.string().default("./storage/files"),

  mailFrom: z.string().default("no-reply@auric.local"),
  smtpUrl: z.string().optional(),
  appName: z.string().default("AURIC"),
  appUrl: z.string().url().default("http://localhost:3000"),

  outboxPollIntervalMs: z.coerce.number().int().positive().default(2000),
  outboxMaxAttempts: z.coerce.number().int().positive().default(5),
  outboxBatchSize: z.coerce.number().int().positive().default(20),
});

export type AuricConfig = z.infer<typeof schema>;

function readEnv(): AuricConfig {
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
    defaultLocale: process.env.AURIC_DEFAULT_LOCALE,
    supportedLocales: process.env.AURIC_SUPPORTED_LOCALES,
    fileStorageDriver: process.env.AURIC_FILE_STORAGE_DRIVER,
    fileStoragePath: process.env.AURIC_FILE_STORAGE_PATH,
    mailFrom: process.env.AURIC_MAIL_FROM,
    smtpUrl: process.env.AURIC_SMTP_URL,
    appName: process.env.AURIC_APP_NAME,
    appUrl: process.env.AURIC_APP_URL,
    outboxPollIntervalMs: process.env.AURIC_OUTBOX_POLL_INTERVAL_MS,
    outboxMaxAttempts: process.env.AURIC_OUTBOX_MAX_ATTEMPTS,
    outboxBatchSize: process.env.AURIC_OUTBOX_BATCH_SIZE,
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
