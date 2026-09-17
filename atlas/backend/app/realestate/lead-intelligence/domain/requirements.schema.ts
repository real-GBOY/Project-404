import { z } from "zod";

/**
 * A lead's structured requirement profile — the AI's ONE job in this module
 * is turning free-text notes into this shape (see
 * `application/structured-ai.ts`). Every field is optional: a real agent's
 * notes rarely specify everything, and an absent field means "no stated
 * preference", not zero — the matching engine (`lead-matching.domain.ts`)
 * treats it as neutral, never as a mismatch.
 *
 * Field choices are deliberately bound to what Atlas's own schema can answer:
 *  - `locations`/`propertyTypes` are free-text tokens matched against
 *    `realestate_projects.location`/`.name` and `realestate_units.unit_type`
 *    — Atlas has no separate "city"/"district" or "bedroom count" column.
 *  - `deliveryWithinMonths` (a relative offset), not an absolute date: the
 *    matching engine computes "now + N months" itself. Asking the model for
 *    date arithmetic (resolving "within two years" against *today*) is
 *    exactly the kind of judgment call this module keeps out of the LLM's
 *    hands — a relative number is trivial for it to extract and impossible
 *    for it to get the arithmetic wrong on.
 */
export const leadRequirementsSchema = z
  .object({
    budgetMinEgp: z.number().int().positive().max(1_000_000_000).nullable().default(null),
    budgetMaxEgp: z.number().int().positive().max(1_000_000_000).nullable().default(null),
    /** Free-text place names as the client said them, e.g. "New Cairo", "Sheikh Zayed". */
    locations: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
    /** Free-text property-type words, e.g. "apartment", "penthouse", "duplex", "studio". */
    propertyTypes: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
    bedroomsMin: z.number().int().min(0).max(12).nullable().default(null),
    bedroomsMax: z.number().int().min(0).max(12).nullable().default(null),
    preferredFloors: z.array(z.number().int().min(0).max(200)).max(10).default([]),
    /** Relative to when the notes were analysed — see the module doc above. */
    deliveryWithinMonths: z.number().int().positive().max(240).nullable().default(null),
    /** Anything real but not scorable against Atlas's schema (e.g. "sea view",
     *  "near a school") — shown to the agent verbatim, never fabricated. */
    otherPreferences: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
    /** A soft, presentational read of urgency/tone — NOT a matching input and
     *  never affects scoring or ordering. */
    intent: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
    /** One-line human summary the model writes for the brief header. */
    summary: z.string().trim().max(240).default(""),
  })
  .strict();

export type LeadRequirements = z.infer<typeof leadRequirementsSchema>;

/** Every field defaulted/absent — used when extraction fails but the UI still
 *  needs a shape to render against, and by tests. */
export const EMPTY_REQUIREMENTS: LeadRequirements = leadRequirementsSchema.parse({});

/**
 * Real Atlas unit-type vocabulary is `"<N>-Bed"`, plus a few bedroom-less
 * labels (`unit.domain.ts#UNIT_TYPES`). Pure string parsing, no AI, no guess —
 * returns `null` when the type doesn't encode a bedroom count.
 */
export function bedroomsOfUnitType(unitType: string): number | null {
  const m = /^(\d+)-Bed$/i.exec(unitType.trim());
  if (m) return Number(m[1]);
  if (/^studio$/i.test(unitType.trim())) return 0;
  return null;
}
