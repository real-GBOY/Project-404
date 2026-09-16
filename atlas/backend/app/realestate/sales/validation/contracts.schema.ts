import { z } from "zod";

export const listContractsQuery = z.object({
  status: z.enum(["draft", "awaiting-approval", "signed"]).optional(),
  projectId: z.string().optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const createContractSchema = z.object({
  reservationId: z.string().nullish(),
  customerId: z.string().min(1),
  unitId: z.string().min(1),
  valueEgp: z.coerce.number().int().positive(),
});

export type ListContractsQuery = z.infer<typeof listContractsQuery>;
export type CreateContractBody = z.infer<typeof createContractSchema>;
