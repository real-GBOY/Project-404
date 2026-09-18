import { z } from "zod";
import { leadRequirementsSchema } from "@atlas/realestate/lead-intelligence/domain/requirements.schema.js";

/**
 * What the model is asked to return for one incremental analysis step. It is
 * UNTRUSTED input: it is parsed and validated here before anything is persisted
 * (`StructuredAi.completeJson` gives the model one repair retry, then gives up
 * without touching the stored state).
 *
 * `requirements` reuses the lead-intelligence schema verbatim, so a conversation's
 * extracted requirements can be applied to a lead with no translation layer.
 */
export const analysisResponseSchema = z
  .object({
    /** 1–3 sentences on what the customer wants and where the conversation stands. */
    summary: z.string().trim().max(700).default(""),
    keyFacts: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(60),
            value: z.string().trim().min(1).max(240),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    actionItems: z
      .array(
        z
          .object({
            action: z.string().trim().min(1).max(240),
            owner: z.enum(["agent", "customer", "unknown"]).default("unknown"),
            due: z.string().trim().min(1).max(80).nullable().default(null),
          })
          .strict(),
      )
      .max(15)
      .default([]),
    unresolvedQuestions: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
    requirements: leadRequirementsSchema,
  })
  .strict();

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

/** The eligibility rule for AUTOMATIC analysis: conversations about these subjects. */
export const AUTO_ANALYZED_SUBJECTS: readonly string[] = ["lead", "customer"];
