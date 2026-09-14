import { z } from "zod";

export const createPaymentPlanSchema = z.object({
  contractId: z.string().min(1),
  downPaymentPct: z.coerce.number().min(0).max(100),
  installmentCount: z.coerce.number().int().min(1).max(120),
  cadence: z.enum(["monthly", "quarterly", "semi-annual", "annual"]).default("quarterly"),
  startDate: z.string().date(),
});

export type CreatePaymentPlanBody = z.infer<typeof createPaymentPlanSchema>;
