import { z } from "zod";

/** Atlas id shape (`lead_…`, `cus_…`, `prj_…`). Rejects anything that isn't an
 *  id so a hint can't smuggle prose into the system prompt. */
const hintId = z
  .string()
  .trim()
  .regex(/^[a-z]{2,6}_[A-Za-z0-9_-]{6,40}$/, "not a valid id");

export const currentContextSchema = z
  .object({
    // screen is a short slug the router derives ("dashboard", "leads", …) — no
    // spaces, no control characters, capped hard.
    screen: z
      .string()
      .trim()
      .max(40)
      .regex(/^[a-z0-9/_-]+$/i, "not a valid screen")
      .optional(),
    projectId: hintId.optional(),
    leadId: hintId.optional(),
    customerId: hintId.optional(),
  })
  .strict();

export const askSchema = z
  .object({
    /** Continue an existing conversation, or omit to start a new one. */
    conversationId: z.string().trim().min(1).max(64).nullish(),
    question: z.string().trim().min(1).max(4000),
    currentContext: currentContextSchema.optional(),
  })
  // Reject unknown keys outright — the endpoint never reads a client-supplied
  // userId / organizationId / role / permissions, and this makes that explicit.
  .strict();

export type AskBody = z.infer<typeof askSchema>;
