import type { DomainEvent } from "../../contracts/domain-event.js";

/**
 * Events the Identity module publishes. Named `<module>.<pastTenseAction>`
 * (§6). Payloads are versioned here; bump the version on a breaking change
 * and keep handlers tolerant.
 */
export const IdentityEvents = {
  UserRegistered: "user.registered",
  UserEmailVerified: "user.email_verified",
  UserPasswordReset: "user.password_reset",
  EmailVerificationRequested: "user.email_verification_requested",
  PasswordResetRequested: "user.password_reset_requested",
} as const;

export const userRegistered = (p: {
  userId: string;
  email: string;
  locale: string | null;
}): DomainEvent => ({ name: IdentityEvents.UserRegistered, version: 1, payload: p });

export const emailVerificationRequested = (p: {
  userId: string;
  email: string;
  token: string;
  locale: string | null;
}): DomainEvent => ({ name: IdentityEvents.EmailVerificationRequested, version: 1, payload: p });

export const passwordResetRequested = (p: {
  userId: string;
  email: string;
  token: string;
  locale: string | null;
}): DomainEvent => ({ name: IdentityEvents.PasswordResetRequested, version: 1, payload: p });

export const userEmailVerified = (p: { userId: string; email: string }): DomainEvent => ({
  name: IdentityEvents.UserEmailVerified,
  version: 1,
  payload: p,
});

export const userPasswordReset = (p: { userId: string }): DomainEvent => ({
  name: IdentityEvents.UserPasswordReset,
  version: 1,
  payload: p,
});
