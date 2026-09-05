import { httpClient } from "@/lib/api/http-client";
import type { LoginResponse, TokenPair } from "@/types/auth";

/**
 * Raw auth endpoint calls. Ported from
 * mizan/web/src/lib/auth/auth-endpoints.ts — same contract, same backend.
 */

export function login(body: {
  email: string;
  password: string;
  organizationId?: string;
}): Promise<LoginResponse> {
  return httpClient<LoginResponse>("/auth/login", { method: "POST", body, anonymous: true });
}

/** Rotate the refresh token, optionally switching the active organization. */
export function refresh(
  refreshToken: string,
  organizationId?: string,
): Promise<{ tokens: TokenPair }> {
  return httpClient<{ tokens: TokenPair }>("/auth/refresh", {
    method: "POST",
    body: { refreshToken, organizationId },
    anonymous: true,
  });
}

/** `202` — always succeeds, never reveals whether the email exists. */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return httpClient<{ message: string }>("/auth/password/forgot", {
    method: "POST",
    body: { email },
    anonymous: true,
  });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return httpClient<void>("/auth/password/reset", {
    method: "POST",
    body: { token, password },
    anonymous: true,
  });
}

export function logoutAll(): Promise<void> {
  return httpClient<void>("/auth/logout-all", { method: "POST" });
}
