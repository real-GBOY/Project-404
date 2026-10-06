import { z } from "zod";
import { ROLE_KEYS } from "@raqib/raqib/shared/modules.js";

const reason = z.string().trim().min(3).max(500);

export const changeRoleSchema = z.object({ role: z.enum(ROLE_KEYS), reason }).strict();
export const setScopeSchema = z.object({ projectIds: z.array(z.string().min(1).max(60)).max(200), reason }).strict();
export const setStatusSchema = z.object({ status: z.enum(["active", "disabled"]), reason }).strict();

const l10n = z.object({ ar: z.string().trim().min(1).max(120), en: z.string().trim().min(1).max(120) }).strict();

/** The details a person's record carries besides role and scope: how they are named, titled and reached. */
export const updateProfileSchema = z
  .object({
    name: l10n,
    title: z.object({ ar: z.string().trim().max(120), en: z.string().trim().max(120) }).strict(),
    phone: z.string().trim().max(30).nullable(),
    employeeNo: z.string().trim().min(1).max(24).nullable(),
    reason: reason.optional(),
  })
  .partial({ name: true, title: true, phone: true, employeeNo: true })
  .strict();

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type ChangeRoleBody = z.infer<typeof changeRoleSchema>;
export type SetScopeBody = z.infer<typeof setScopeSchema>;
export type SetStatusBody = z.infer<typeof setStatusSchema>;
