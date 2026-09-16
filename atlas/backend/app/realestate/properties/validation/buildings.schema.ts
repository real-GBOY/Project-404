import { z } from "zod";

export const listBuildingsQuery = z.object({
  projectId: z.string().optional(),
  status: z.enum(["pre-launch", "launched", "under-construction", "delivered"]).optional(),
  /** Free-text search across name/key, ranked by relevance. */
  q: z.string().trim().min(1).max(200).optional(),
});

export const createBuildingSchema = z.object({
  projectId: z.string().min(1),
  key: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(200),
  floors: z.coerce.number().int().min(1).max(200),
  unitsPerFloor: z.coerce.number().int().min(1).max(100),
  handoverDate: z.string().date().nullish(),
  status: z.enum(["pre-launch", "launched", "under-construction", "delivered"]).optional(),
});

export const updateBuildingSchema = createBuildingSchema.omit({ projectId: true, key: true }).partial();

export type ListBuildingsQuery = z.infer<typeof listBuildingsQuery>;
export type CreateBuildingBody = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingBody = z.infer<typeof updateBuildingSchema>;
