import { z } from "zod";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(80).optional(),
  location: z.string().trim().min(2).max(200),
  developer: z.string().trim().min(2).max(200),
  status: z.enum(["pre-launch", "launched", "under-construction", "delivered"]).optional(),
});

export const updateProjectSchema = createProjectSchema.omit({ slug: true }).partial();

export type CreateProjectBody = z.infer<typeof createProjectSchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>;

export { slugify };
