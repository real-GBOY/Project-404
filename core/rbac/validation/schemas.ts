import { z } from "zod";

const key = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, "Keys are lowercase letters, digits, underscore and dash.");

export const createRoleSchema = z.object({
  key,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

export const assignRoleSchema = z.object({
  userId: z.string().min(1),
  roleKey: key,
});

export const grantPermissionSchema = z.object({
  action: z.string().trim().min(1).max(64),
  resource: z.string().trim().min(1).max(64),
});
