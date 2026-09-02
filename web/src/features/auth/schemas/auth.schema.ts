import { z } from "zod";

/**
 * Form-level validation. Mirrors the backend's `core/identity/validation`
 * (password 10–200; email trimmed + lowercased) — the backend re-validates.
 * Messages are i18n keys under the `auth` namespace (`errors.*`).
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "errors.email_required")
  .email("errors.email_invalid")
  .max(320);

const newPassword = z
  .string()
  .min(10, "errors.password_short")
  .max(200, "errors.password_long");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "errors.password_required"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, "errors.confirm_required"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "errors.password_mismatch",
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const resendVerificationSchema = z.object({ email });
export type ResendVerificationValues = z.infer<typeof resendVerificationSchema>;
