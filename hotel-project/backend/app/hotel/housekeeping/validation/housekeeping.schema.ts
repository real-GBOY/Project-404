import { z } from "zod";
import { TASK_STATUSES } from "../domain/task-state.js";

export const listTasksQuery = z.object({
  status: z.enum(TASK_STATUSES as [string, ...string[]]).optional(),
  open: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  mine: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  board: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const createTaskSchema = z
  .object({
    roomId: z.string().min(1),
    kind: z.enum(["checkout_clean", "stayover", "deep_clean"]),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    notes: z.string().trim().max(500).nullable().default(null),
  })
  .strict();

export const assignSchema = z.object({ assigneeId: z.string().min(1) }).strict();

export const completeSchema = z
  .object({ notes: z.string().trim().max(500).nullable().default(null) })
  .strict();

export type ListTasksQuery = z.infer<typeof listTasksQuery>;
export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type AssignBody = z.infer<typeof assignSchema>;
export type CompleteBody = z.infer<typeof completeSchema>;
