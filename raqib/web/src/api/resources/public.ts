import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { PublicOnboardingInfo, PublicRequestBody } from "../types";

/** The few calls an anonymous person may make: the account-request form and the emailed password link. */
export const publicApi = {
  onboardingInfo: (org: string) =>
    http<PublicOnboardingInfo>(ENDPOINTS.publicOnboarding.info(org), { anonymous: true }),
  submitRequest: (org: string, body: PublicRequestBody) =>
    http<{ ref: string }>(ENDPOINTS.publicOnboarding.requests(org), {
      method: "POST",
      body,
      anonymous: true,
    }),
  setPassword: (token: string, password: string) =>
    http<void>(ENDPOINTS.auth.reset, {
      method: "POST",
      body: { token, password },
      anonymous: true,
    }),
};
