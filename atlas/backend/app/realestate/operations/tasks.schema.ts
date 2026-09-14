import { z } from "zod";

export const createTaskSchema = z.object({
  priority: z.enum(["high", "medium", "low"]).optional(),
  title: z.string().trim().min(1).max(300),
  relatedType: z.string().nullish(),
  relatedId: z.string().nullish(),
  assigneeId: z.string().min(1),
  dueAt: z.string().datetime(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["open", "in-progress", "done"]),
});

export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusBody = z.infer<typeof updateTaskStatusSchema>;
