import { z } from "zod";

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullish(),
  steps: z.array(z.object({ label: z.string().trim().min(1).max(200), assigneeId: z.string().nullish() })).min(1),
});

export type CreateWorkflowBody = z.infer<typeof createWorkflowSchema>;
