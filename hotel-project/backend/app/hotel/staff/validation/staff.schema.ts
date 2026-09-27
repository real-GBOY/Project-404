import { z } from "zod";

export const addStaffSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    roleKey: z.string().min(1),
    /** Initial password the staff member signs in with; Core email verification still applies. */
    temporaryPassword: z.string().min(10).max(200),
  })
  .strict();

export const changeRoleSchema = z.object({ roleKey: z.string().min(1) }).strict();

export type AddStaffBody = z.infer<typeof addStaffSchema>;
export type ChangeRoleBody = z.infer<typeof changeRoleSchema>;
