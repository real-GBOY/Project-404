import { z } from "zod";

export const matterSchema = z.object({
  title: z.string().trim().min(3, "matters.errors.title_required").max(300),
  clientId: z.string().min(1, "matters.errors.client_required"),
  practiceArea: z.string().min(1, "matters.errors.practice_required"),
  court: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});
export type MatterFormValues = z.input<typeof matterSchema>;
export type MatterFormOutput = z.output<typeof matterSchema>;

export const noteSchema = z.object({
  body: z.string().trim().min(1, "matters.errors.note_required").max(4000),
});
export type NoteFormValues = z.infer<typeof noteSchema>;

export const updateSchema = z.object({
  body: z.string().trim().min(1, "matters.errors.update_required").max(4000),
});
export type UpdateFormValues = z.infer<typeof updateSchema>;
