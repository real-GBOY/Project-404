/**
 * Every backend route the app calls, in one place (atlas/web convention). Paths are relative to
 * `API_BASE_URL`; dynamic segments are functions. Grows with each slice.
 */
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },
  me: "/me",
} as const;
