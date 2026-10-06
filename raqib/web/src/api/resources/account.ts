import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { SecurityStatus } from "../types";

export const accountApi = {
  security: () => http<SecurityStatus>(ENDPOINTS.account.security),
  mfaSetup: () =>
    http<{ secret: string; uri: string }>(ENDPOINTS.account.mfaSetup, {
      method: "POST",
      body: {},
    }),
  mfaEnable: (code: string) =>
    http<{ recoveryCodes: string[] }>(ENDPOINTS.account.mfaEnable, {
      method: "POST",
      body: { code },
    }),
  mfaDisable: (password: string, code: string) =>
    http<void>(ENDPOINTS.account.mfaDisable, { method: "POST", body: { password, code } }),
  changePassword: (current: string, next: string) =>
    http<void>(ENDPOINTS.account.password, { method: "POST", body: { current, next } }),
  revokeSessions: () => http<void>(ENDPOINTS.account.revoke, { method: "POST", body: {} }),
};
