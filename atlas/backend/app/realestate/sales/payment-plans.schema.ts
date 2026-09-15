import { z } from "zod";

export const listInstallmentsQuery = z.object({
  status: z.enum(["pending", "partial", "paid", "overdue"]).optional(),
  projectId: z.string().optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const createPaymentPlanSchema = z.object({
  contractId: z.string().min(1),
  downPaymentPct: z.coerce.number().min(0).max(100),
  installmentCount: z.coerce.number().int().min(1).max(120),
  cadence: z.enum(["monthly", "quarterly", "semi-annual", "annual"]).default("quarterly"),
  startDate: z.string().date(),
});

export type ListInstallmentsQuery = z.infer<typeof listInstallmentsQuery>;
export type CreatePaymentPlanBody = z.infer<typeof createPaymentPlanSchema>;
