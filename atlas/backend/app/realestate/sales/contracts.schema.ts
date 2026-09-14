import { z } from "zod";

export const createContractSchema = z.object({
  reservationId: z.string().nullish(),
  customerId: z.string().min(1),
  unitId: z.string().min(1),
  valueEgp: z.coerce.number().int().positive(),
});

export type CreateContractBody = z.infer<typeof createContractSchema>;
