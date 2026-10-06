import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { LoginResponse } from "../types";

export const authApi = {
  login: (email: string, password: string, otp?: string) =>
    http<LoginResponse>(ENDPOINTS.auth.login, {
      method: "POST",
      body: { email, password, ...(otp ? { otp } : {}) },
      anonymous: true,
    }),
  forgot: (email: string) =>
    http<void>(ENDPOINTS.auth.forgot, { method: "POST", body: { email }, anonymous: true }),
  logout: (refreshToken: string) =>
    http<void>(ENDPOINTS.auth.logout, {
      method: "POST",
      body: { refreshToken },
      anonymous: true,
    }),
};
