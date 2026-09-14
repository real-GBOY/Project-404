import { z } from "zod";

export const assignRoleSchema = z.object({ userId: z.string().min(1), role: z.string().min(1) });

export const updateOrgSettingsSchema = z.object({
  reservationHoldDays: z.coerce.number().int().min(1).max(90).optional(),
  escalationDays: z.coerce.number().int().min(1).max(90).optional(),
  defaultDiscountPct: z.coerce.number().min(0).max(100).optional(),
  aiInsightRefreshMinutes: z.coerce.number().int().min(5).max(1440).optional(),
});

export type AssignRoleBody = z.infer<typeof assignRoleSchema>;
export type UpdateOrgSettingsBody = z.infer<typeof updateOrgSettingsSchema>;
