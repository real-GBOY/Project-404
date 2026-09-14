import { z } from "zod";

export const recordPaymentSchema = z.object({
  customerId: z.string().min(1),
  unitId: z.string().min(1),
  installmentId: z.string().nullish(),
  amountEgp: z.coerce.number().int().positive(),
  method: z.enum(["bank-transfer", "cheque", "cash", "card"]),
});

export type RecordPaymentBody = z.infer<typeof recordPaymentSchema>;
