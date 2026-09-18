import { z } from "zod";

const id = z.string().trim().min(1).max(128);

/** Applying insights to a lead: the lead comes from the conversation's subject, or is named explicitly. */
export const applyRequirementsSchema = z.object({ leadId: id.optional() });
export type ApplyRequirementsBody = z.infer<typeof applyRequirementsSchema>;

/**
 * Creating a follow-up from an action item. The text and due date are the USER's
 * (the UI pre-fills them from the AI suggestion and lets the agent edit) — the
 * server never trusts the model to decide a business commitment.
 */
export const createFollowupSchema = z.object({
  leadId: id.optional(),
  reason: z.string().trim().min(1).max(300),
  dueAt: z.string().datetime({ offset: true }),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});
export type CreateFollowupBody = z.infer<typeof createFollowupSchema>;
