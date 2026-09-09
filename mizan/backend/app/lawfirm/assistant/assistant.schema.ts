import { z } from "zod";

export const currentContextSchema = z
  .object({
    screen: z.string().trim().max(60).optional(),
    matterId: z.string().trim().max(64).optional(),
    clientId: z.string().trim().max(64).optional(),
  })
  .strict();

export const chatRequestSchema = z.object({
  /** Continue an existing conversation, or omit to start a new one. */
  conversationId: z.string().trim().min(1).max(64).optional(),
  message: z.string().trim().min(1).max(4000),
  currentContext: currentContextSchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
