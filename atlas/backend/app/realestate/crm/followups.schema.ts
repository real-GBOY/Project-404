import { z } from "zod";

export const createFollowupSchema = z.object({
  priority: z.enum(["high", "medium", "low"]).optional(),
  leadId: z.string().nullish(),
  customerId: z.string().nullish(),
  reason: z.string().trim().min(1).max(400),
  agentId: z.string().min(1),
  dueAt: z.string().datetime(),
});

export const updateFollowupStatusSchema = z.object({
  status: z.enum(["open", "in-progress", "overdue", "done"]),
});

export const listFollowupsQuery = z.object({
  agentId: z.string().optional(),
  status: z.enum(["open", "in-progress", "overdue", "done"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  /** Free-text search across the reason, ranked by relevance. */
  q: z.string().trim().min(1).max(200).optional(),
});

export type CreateFollowupBody = z.infer<typeof createFollowupSchema>;
export type UpdateFollowupStatusBody = z.infer<typeof updateFollowupStatusSchema>;
export type ListFollowupsQuery = z.infer<typeof listFollowupsQuery>;
