import { z } from "zod";

/**
 * HotelOS's own configuration — the variables that only this product reads. Everything
 * Core-owned (database, JWT, files, mail, outbox, CORS) stays in `core/kernel/config.ts` under
 * its `AURIC_*` names; this file never duplicates any of it. Parsed with the same fail-fast
 * approach as Core's: a bad value throws at boot, not at first use.
 */
const schema = z.object({
  /** Seed the Hotel Nayel demo property on boot. Never enable against real data. */
  seedDemo: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** How many days of past business the demo plays through the real workflows. */
  demoHistoryDays: z.coerce.number().int().min(1).max(365).default(120),
});

export type HotelConfig = z.infer<typeof schema>;

export function readHotelConfig(env: NodeJS.ProcessEnv = process.env): HotelConfig {
  const parsed = schema.safeParse({
    seedDemo: env.HOTEL_SEED_DEMO,
    demoHistoryDays: env.HOTEL_DEMO_HISTORY_DAYS,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid HotelOS configuration:\n${issues}`);
  }
  return parsed.data;
}
