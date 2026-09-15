import { z } from "zod";

export const listTasksQuery = z.object({
  assigneeId: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["open", "in-progress", "done"]).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

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

export type ListTasksQuery = z.infer<typeof listTasksQuery>;
export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusBody = z.infer<typeof updateTaskStatusSchema>;
