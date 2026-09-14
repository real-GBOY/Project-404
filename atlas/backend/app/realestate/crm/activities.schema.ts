import { z } from "zod";

export const createActivitySchema = z.object({
  type: z.enum(["call", "meeting", "viewing", "email", "note", "whatsapp"]),
  subject: z.string().trim().min(1).max(300),
  relatedType: z.enum(["lead", "customer"]).nullish(),
  relatedId: z.string().nullish(),
  agentId: z.string().min(1),
  outcome: z.string().trim().max(1000).nullish(),
});

export const listActivitiesQuery = z.object({
  relatedType: z.string().optional(),
  relatedId: z.string().optional(),
});

export type CreateActivityBody = z.infer<typeof createActivitySchema>;
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuery>;
