import { z } from "zod";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const listProjectsQuery = z.object({
  status: z.enum(["pre-launch", "launched", "under-construction", "delivered"]).optional(),
  developer: z.string().optional(),
  /** Free-text search across name/location/developer, ranked by relevance. */
  q: z.string().trim().min(1).max(200).optional(),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(80).optional(),
  location: z.string().trim().min(2).max(200),
  developer: z.string().trim().min(2).max(200),
  status: z.enum(["pre-launch", "launched", "under-construction", "delivered"]).optional(),
});

export const updateProjectSchema = createProjectSchema.omit({ slug: true }).partial();

export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;
export type CreateProjectBody = z.infer<typeof createProjectSchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>;

export { slugify };
