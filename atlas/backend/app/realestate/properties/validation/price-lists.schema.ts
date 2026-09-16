import { z } from "zod";

export const listPriceListsQuery = z.object({
  projectId: z.string().optional(),
  status: z.enum(["draft", "awaiting-approval", "active"]).optional(),
  /** Free-text search across name/version, ranked by relevance. */
  q: z.string().trim().min(1).max(200).optional(),
});

export const createPriceListSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(40),
  basePerSqmEgp: z.coerce.number().int().positive(),
  floorPremiumPct: z.coerce.number().min(0).max(100).optional(),
  maxDiscountPct: z.coerce.number().min(0).max(100).optional(),
  effectiveDate: z.string().date(),
  status: z.enum(["draft", "awaiting-approval", "active"]).optional(),
});

export const updatePriceListSchema = createPriceListSchema
  .omit({ projectId: true, effectiveDate: true, version: true })
  .partial();

export type ListPriceListsQuery = z.infer<typeof listPriceListsQuery>;
export type CreatePriceListBody = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListBody = z.infer<typeof updatePriceListSchema>;
