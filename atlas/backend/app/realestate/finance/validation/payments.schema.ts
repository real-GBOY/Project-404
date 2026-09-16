import { z } from "zod";

export const listPaymentsQuery = z.object({
  customerId: z.string().optional(),
  method: z.enum(["bank-transfer", "cheque", "cash", "card"]).optional(),
  status: z.enum(["paid", "pending", "overdue"]).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const collectionsQuery = z.object({
  projectId: z.string().optional(),
});

export const outstandingQuery = z.object({
  agentId: z.string().optional(),
  projectId: z.string().optional(),
});

export const recordPaymentSchema = z.object({
  customerId: z.string().min(1),
  unitId: z.string().min(1),
  installmentId: z.string().nullish(),
  amountEgp: z.coerce.number().int().positive(),
  method: z.enum(["bank-transfer", "cheque", "cash", "card"]),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuery>;
export type CollectionsQuery = z.infer<typeof collectionsQuery>;
export type OutstandingQuery = z.infer<typeof outstandingQuery>;
export type RecordPaymentBody = z.infer<typeof recordPaymentSchema>;
