import { z } from "zod";

const password = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(200, "Password must be at most 200 characters.");

const email = z.string().trim().toLowerCase().email("A valid email is required.").max(320);

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(120).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1),
  /** Tenant to sign in to (§ docs/tenancy.md); omit for the sole/none. */
  organizationId: z.string().min(1).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
  /** Switch the active tenant on refresh. */
  organizationId: z.string().min(1).optional(),
});

export const requestPasswordResetSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
});

export const verifyEmailSchema = z.object({ token: z.string().min(1) });

export const requestEmailVerificationSchema = z.object({ email });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
