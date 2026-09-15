import { z } from "zod";

export const listUnitsQuery = z.object({
  projectId: z.string().optional(),
  buildingId: z.string().optional(),
  status: z.enum(["available", "reserved", "sold", "on-hold", "unavailable"]).optional(),
  unitType: z.string().optional(),
});

export const updateUnitStatusSchema = z.object({
  status: z.enum(["available", "reserved", "sold", "on-hold", "unavailable"]),
  customerId: z.string().nullish(),
  agentId: z.string().nullish(),
});

export type ListUnitsQuery = z.infer<typeof listUnitsQuery>;
export type UpdateUnitStatusBody = z.infer<typeof updateUnitStatusSchema>;
