import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const l10n = (max: number) => z.object({ ar: text(max), en: text(max) }).strict();
const optL10n = (max: number) => z.object({ ar: z.string().trim().max(max), en: z.string().trim().max(max) }).strict();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createProjectSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,24}$/, "3–24 letters, digits or dashes"),
    name: l10n(120),
    city: optL10n(60).default({ ar: "", en: "" }),
    region: optL10n(60).default({ ar: "", en: "" }),
    managerUserId: z.string().min(1).max(60).nullish(),
    status: z.enum(["active", "attention", "mobilizing", "closed"]).default("mobilizing"),
    firstVisitDate: isoDate.nullish(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: l10n(120),
    city: optL10n(60),
    region: optL10n(60),
    managerUserId: z.string().min(1).max(60).nullable(),
    status: z.enum(["active", "attention", "mobilizing", "closed"]),
    firstVisitDate: isoDate.nullable(),
  })
  .partial()
  .strict();

export const nameSchema = z.object({ name: l10n(120) }).strict();

export type CreateProjectBody = z.infer<typeof createProjectSchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>;
export type NameBody = z.infer<typeof nameSchema>;

const shift = z.enum(["morning", "evening", "night"]);
const nationalId = z
  .string()
  .trim()
  .regex(/^[0-9]{10}$/, "10 digits");

export const createGuardSchema = z
  .object({
    projectId: z.string().min(1).max(60),
    employeeNo: z.string().trim().min(3).max(24),
    nationalId,
    name: l10n(120),
    post: optL10n(120).default({ ar: "", en: "" }),
    shift: shift.default("morning"),
    /** The guard's sign-in account (a person with the guard role), so they can use the confidential area. */
    userId: z.string().min(1).max(60).nullish(),
  })
  .strict();

export const updateGuardSchema = z
  .object({
    projectId: z.string().min(1).max(60),
    nationalId,
    name: l10n(120),
    post: optL10n(120),
    shift,
    userId: z.string().min(1).max(60).nullable(),
  })
  .partial()
  .strict();

export const guardStatusSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();

export type CreateGuardBody = z.infer<typeof createGuardSchema>;
export type UpdateGuardBody = z.infer<typeof updateGuardSchema>;
export type GuardStatusBody = z.infer<typeof guardStatusSchema>;
