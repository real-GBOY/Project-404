/**
 * Every backend route the app calls, in one place. Paths are relative to `API_BASE_URL`; dynamic
 * segments are functions. (Backend: raqib/backend/app/raqib/*.)
 */
export const ENDPOINTS = {
  auth: { login: "/auth/login", refresh: "/auth/refresh", logout: "/auth/logout" },
  me: "/raqib/me",
  settings: "/raqib/settings",
  permissions: "/raqib/permissions",
  users: {
    list: "/raqib/users",
    byId: (id: string) => `/raqib/users/${id}`,
    role: (id: string) => `/raqib/users/${id}/role`,
    scope: (id: string) => `/raqib/users/${id}/scope`,
    status: (id: string) => `/raqib/users/${id}/status`,
  },
  projects: {
    list: "/raqib/projects",
    byId: (id: string) => `/raqib/projects/${id}`,
    sites: (id: string) => `/raqib/projects/${id}/sites`,
  },
  sites: { byId: (id: string) => `/raqib/sites/${id}`, areas: (id: string) => `/raqib/sites/${id}/areas` },
  areas: { byId: (id: string) => `/raqib/areas/${id}` },
  visits: {
    list: "/raqib/visits",
    byId: (id: string) => `/raqib/visits/${id}`,
    reschedule: (id: string) => `/raqib/visits/${id}/reschedule`,
    cancel: (id: string) => `/raqib/visits/${id}/cancel`,
    inspectors: "/raqib/visits/inspectors/eligible",
  },
  notifications: {
    list: "/notifications",
    read: (id: string) => `/notifications/${id}/read`,
    readAll: "/notifications/read-all",
  },
  guards: { list: "/raqib/guards", byId: (id: string) => `/raqib/guards/${id}` },
} as const;
