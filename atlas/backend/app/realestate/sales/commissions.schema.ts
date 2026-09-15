import { z } from "zod";

export const listCommissionsQuery = z.object({
  agentId: z.string().optional(),
  period: z.string().optional(),
  status: z.enum(["pending", "approved", "paid"]).optional(),
});

export const upsertCommissionSchema = z.object({
  agentId: z.string().min(1),
  period: z.string().date(),
  contractsCount: z.coerce.number().int().min(0),
  salesValueEgp: z.coerce.number().int().min(0),
  ratePct: z.coerce.number().min(0).max(100),
});

export const updateCommissionStatusSchema = z.object({
  status: z.enum(["pending", "approved", "paid"]),
});

export type ListCommissionsQuery = z.infer<typeof listCommissionsQuery>;
export type UpsertCommissionBody = z.infer<typeof upsertCommissionSchema>;
export type UpdateCommissionStatusBody = z.infer<typeof updateCommissionStatusSchema>;
