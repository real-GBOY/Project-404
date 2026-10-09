import { z } from "zod";

export const proofPresignSchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().trim().toLowerCase().min(3).max(80),
    byteSize: z.number().int().min(1).max(52_428_800),
  })
  .strict();
export type ProofPresignBody = z.infer<typeof proofPresignSchema>;

export const submitProofSchema = z
  .object({
    fileId: z.string().min(1).max(64),
    methodId: z.string().min(1).max(64).nullable().optional(),
    transactionId: z.string().trim().min(4, "Transaction ID must be 4-40 characters.").max(40, "Transaction ID must be 4-40 characters.").nullable().optional(),
    sentFrom: z.string().trim().max(120).nullable().optional(),
    amountMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
  })
  .strict();
export type SubmitProofBody = z.infer<typeof submitProofSchema>;

/** `version` is the submission version the reviewer was looking at; `idempotencyKey` makes a double click harmless. */
export const approveSchema = z
  .object({
    version: z.number().int().min(1),
    idempotencyKey: z.string().min(8).max(80),
    internalNote: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
export type ApproveBody = z.infer<typeof approveSchema>;

export const rejectSchema = z
  .object({
    version: z.number().int().min(1),
    idempotencyKey: z.string().min(8).max(80),
    reason: z.string().trim().min(10, "Tell the customer what to fix.").max(500, "Tell the customer what to fix."),
    internalNote: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
export type RejectBody = z.infer<typeof rejectSchema>;

export const queueQuery = z.object({ eventId: z.string().max(64).optional() });
export type QueueQuery = z.infer<typeof queueQuery>;
