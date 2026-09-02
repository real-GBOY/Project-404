import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const listMattersQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["all", "open", "on_hold", "closed"]).default("all"),
  practiceArea: z.string().trim().max(120).optional(),
  clientId: z.string().trim().max(60).optional(),
  sort: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const createMatterSchema = z.object({
  title: z.string().trim().min(3).max(300),
  clientId: z.string().min(1),
  practiceArea: z.string().trim().min(1).max(120),
  court: optionalTrimmed(160),
  description: optionalTrimmed(4000),
});

export const updateMatterSchema = createMatterSchema.partial();

export const addParticipantSchema = z.object({
  userId: z.string().min(1),
  role: z.string().trim().min(1).max(60),
});

export const addUpdateSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  documentIds: z.array(z.string().min(1)).max(50).optional(),
});

export const noteBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type ListMattersQuery = z.infer<typeof listMattersQuery>;
export type CreateMatterBody = z.infer<typeof createMatterSchema>;
export type UpdateMatterBody = z.infer<typeof updateMatterSchema>;
