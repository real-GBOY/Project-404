import { z } from "zod";
import { ITEM_TYPES } from "../domain/form.js";

const text = (max: number) => z.string().trim().max(max);
const l10n = (max: number) => z.object({ ar: text(max), en: text(max) }).strict();
const reason = z.string().trim().min(3).max(500);

const item = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/),
    text: l10n(500),
    weight: z.number().int().min(0).max(10),
    type: z.enum(ITEM_TYPES),
    required: z.boolean(),
    na: z.boolean(),
    evidenceOnNc: z.boolean(),
  })
  .strict();
const section = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/),
    title: l10n(160),
    items: z.array(item).max(200),
  })
  .strict();

export const createFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,24}$/),
    category: z.enum(["site", "guard"]),
    name: z.object({ ar: text(160).min(1), en: text(160).min(1) }).strict(),
    description: l10n(500).default({ ar: "", en: "" }),
  })
  .strict();
export const updateFormSchema = z
  .object({ name: z.object({ ar: text(160).min(1), en: text(160).min(1) }).strict(), description: l10n(500) })
  .partial()
  .strict();
export const saveDraftSchema = z.object({ sections: z.array(section).max(40), note: l10n(500).optional() }).strict();
export const reasonSchema = z.object({ reason }).strict();
export const activeSchema = z.object({ active: z.boolean(), reason }).strict();

export type CreateFormBody = z.infer<typeof createFormSchema>;
export type UpdateFormBody = z.infer<typeof updateFormSchema>;
export type SaveDraftBody = z.infer<typeof saveDraftSchema>;
export type ReasonBody = z.infer<typeof reasonSchema>;
export type ActiveBody = z.infer<typeof activeSchema>;
