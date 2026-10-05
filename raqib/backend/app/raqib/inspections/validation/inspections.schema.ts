import { z } from "zod";

export const answerSchema = z
  .object({
    value: z.enum(["c", "n", "x"]).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    severity: z.enum(["low", "medium", "high"]).nullable().optional(),
  })
  .strict()
  .refine((b) => b.value !== undefined || b.note !== undefined || b.severity !== undefined, "Nothing to change");
export const guardScoreSchema = z.object({ score: z.number().int().min(1).max(5) }).strict();
export const guardNoteSchema = z.object({ note: z.string().max(2000) }).strict();

export type AnswerBody = z.infer<typeof answerSchema>;
export type GuardScoreBody = z.infer<typeof guardScoreSchema>;
export type GuardNoteBody = z.infer<typeof guardNoteSchema>;
