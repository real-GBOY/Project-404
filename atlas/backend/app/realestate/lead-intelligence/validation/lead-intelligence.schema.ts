import { z } from "zod";

export const extractRequirementsSchema = z
  .object({
    /** The agent's free-text notes about what the client wants — English,
     *  Arabic, or a mix of both. */
    notes: z.string().trim().min(3).max(2000),
  })
  .strict();

export type ExtractRequirementsBody = z.infer<typeof extractRequirementsSchema>;
