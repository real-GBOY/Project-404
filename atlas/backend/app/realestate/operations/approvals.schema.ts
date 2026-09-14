import { z } from "zod";

export const createApprovalSchema = z.object({
  kind: z.enum(["discount", "refund", "contract", "commission", "other"]),
  subject: z.string().trim().min(1).max(400),
  relatedType: z.string().nullish(),
  relatedId: z.string().nullish(),
  amountEgp: z.coerce.number().int().nullish(),
  requestedBy: z.string().min(1),
  stepTotal: z.coerce.number().int().min(1).max(10).optional(),
});

export const decideApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

export type CreateApprovalBody = z.infer<typeof createApprovalSchema>;
export type DecideApprovalBody = z.infer<typeof decideApprovalSchema>;
