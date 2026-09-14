import { z } from "zod";

export const askSchema = z.object({
  conversationId: z.string().nullish(),
  question: z.string().trim().min(1).max(2000),
});

export type AskBody = z.infer<typeof askSchema>;
