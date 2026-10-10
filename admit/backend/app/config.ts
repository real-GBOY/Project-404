import { z } from "zod";

/**
 * Admit's own configuration - the variables that only this product reads. Everything Core-owned
 * (database, JWT, files, mail, outbox, CORS) stays in `core/kernel/config.ts` under its `AURIC_*`
 * names; this file never duplicates any of it. Parsed with the same fail-fast approach as Core's:
 * a bad value throws at boot, not at first use.
 */
const schema = z.object({
  /** Seed the demo organizer (fictional events, bookings and tickets) on boot. Never enable against real data. */
  seedDemo: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /**
   * A deliberate second key for a dedicated showcase deployment: lets `ADMIT_SEED_DEMO=true` run with NODE_ENV=production.
   * Without it production refuses to seed, so the demo organizer can never appear next to real data by accident.
   */
  allowDemoInProduction: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** How many days of past activity the demo plays through the real workflows. */
  demoHistoryDays: z.coerce.number().int().min(1).max(365).default(30),
  /** How often the scheduled jobs (booking-hold expiry, rate-limit pruning) run. Default 5 minutes. */
  jobsIntervalMs: z.coerce.number().int().min(10_000).default(300_000),
  /**
   * How many reverse proxies sit in front of the API (e.g. 1 for nginx). The public API takes the
   * client's address from X-Forwarded-For only this many hops from the right - the entries our
   * own proxies appended - so a visitor can't spoof it to dodge rate limits. 0 = direct.
   */
  trustedProxyHops: z.coerce.number().int().min(0).max(5).default(0),
  /**
   * Secret the QR token of every ticket is derived from (HMAC of the ticket id). The database holds only a hash
   * of each token, so losing this key makes issued QR codes unreadable: back it up with the database password.
   * 32 random bytes, base64. Required in production.
   */
  ticketKey: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64 encoded"),
  /** Origin the customer web app is served from; magic links in emails and tickets point here. */
  publicUrl: z.string().trim().default(""),
  /** Public origin of this API, used for the QR image URLs inside emails (an email client cannot reach localhost). */
  apiUrl: z.string().trim().default(""),
  /**
   * What every ticket QR opens when scanned with an ordinary phone: this picture. The QR holds `<this url>#<ticket token>`; a browser
   * ignores the part after `#`, and the door scanner reads the token from it.
   */
  qrImageUrl: z.string().trim().url().default("https://i.postimg.cc/cCvLrpyG/Whats-App-Image-2026-10-10-at-2-27-41-PM.jpg"),
  /** How long a magic link (booking status / tickets) stays valid. */
  accessLinkDays: z.coerce.number().int().min(1).max(365).default(30),
  /** Largest payment-proof file, in bytes. */
  proofMaxBytes: z.coerce.number().int().min(1024).max(52_428_800).default(10_485_760),
});

export type AdmitConfig = z.infer<typeof schema>;

export function readAdmitConfig(env: NodeJS.ProcessEnv = process.env): AdmitConfig {
  const parsed = schema.safeParse({
    seedDemo: env.ADMIT_SEED_DEMO,
    allowDemoInProduction: env.ADMIT_ALLOW_DEMO_IN_PRODUCTION,
    demoHistoryDays: env.ADMIT_DEMO_HISTORY_DAYS,
    jobsIntervalMs: env.ADMIT_JOBS_INTERVAL_MS,
    trustedProxyHops: env.ADMIT_TRUSTED_PROXY_HOPS,
    ticketKey: env.ADMIT_TICKET_KEY,
    publicUrl: env.ADMIT_PUBLIC_URL,
    apiUrl: env.ADMIT_API_URL,
    qrImageUrl: env.ADMIT_QR_IMAGE_URL,
    accessLinkDays: env.ADMIT_ACCESS_LINK_DAYS,
    proofMaxBytes: env.ADMIT_PROOF_MAX_BYTES,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid Admit configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Why the demo organizer may not be seeded in this process, or null when it may. Production needs the explicit second key. */
export function demoSeedRefusal(cfg: Pick<AdmitConfig, "seedDemo" | "allowDemoInProduction">, nodeEnv: string): string | null {
  if (!cfg.seedDemo || nodeEnv !== "production" || cfg.allowDemoInProduction) return null;
  return "ADMIT_SEED_DEMO=true is refused in production: the demo organizer must never be created next to real data. A dedicated showcase deployment can opt in with ADMIT_ALLOW_DEMO_IN_PRODUCTION=true.";
}
