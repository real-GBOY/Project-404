import { z } from "zod";
import { ROLE_KEYS } from "@raqib/raqib/shared/modules.js";

const reason = z.string().trim().min(3).max(500);

export const changeRoleSchema = z.object({ role: z.enum(ROLE_KEYS), reason }).strict();
export const setScopeSchema = z.object({ projectIds: z.array(z.string().min(1).max(60)).max(200), reason }).strict();
export const setStatusSchema = z.object({ status: z.enum(["active", "disabled"]), reason }).strict();

export type ChangeRoleBody = z.infer<typeof changeRoleSchema>;
export type SetScopeBody = z.infer<typeof setScopeSchema>;
export type SetStatusBody = z.infer<typeof setStatusSchema>;
