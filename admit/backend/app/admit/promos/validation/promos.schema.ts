import { z } from "zod";
import { normalizeCode } from "../domain/pricing.js";

export const codeField = z
  .string()
  .transform(normalizeCode)
  .pipe(
    z
      .string()
      .min(3, "Use 3-24 letters, digits or dashes.")
      .max(24, "Use 3-24 letters, digits or dashes.")
      .regex(/^[A-Z0-9_-]+$/, "Use only letters, digits, dashes and underscores."),
  );

const dateField = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

const promoBase = z.object({
  code: codeField,
  kind: z.enum(["percent", "fixed"]),
  /** percent: 1-99. fixed: minor units (piastres). */
  value: z.number().int().min(1).max(10_000_000),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().default(null),
  validFrom: dateField.nullable().default(null),
  validUntil: dateField.nullable().default(null),
  enabled: z.boolean().default(true),
});

interface Checkable {
  kind?: string;
  value?: number;
  validFrom?: Date | null;
  validUntil?: Date | null;
}
export const checkPromo = (v: Checkable, ctx: z.RefinementCtx): void => {
  if (v.kind === "percent" && v.value !== undefined && v.value > 99) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage must be between 1 and 99." });
  }
  if (v.validFrom && v.validUntil && v.validUntil <= v.validFrom) {
    ctx.addIssue({ code: "custom", path: ["validUntil"], message: "The end must be after the start." });
  }
};

export const createPromoSchema = promoBase.strict().superRefine(checkPromo);
export const updatePromoSchema = promoBase.omit({ code: true }).partial().strict().superRefine(checkPromo);
export type CreatePromoBody = z.infer<typeof createPromoSchema>;
export type UpdatePromoBody = z.infer<typeof updatePromoSchema>;

export const previewPromoSchema = z
  .object({
    code: codeField,
    items: z
      .array(z.object({ ticketTypeId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(6) }).strict())
      .min(1)
      .max(10),
  })
  .strict();
export type PreviewPromoBody = z.infer<typeof previewPromoSchema>;
