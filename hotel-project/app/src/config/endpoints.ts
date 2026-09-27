/**
 * Every backend route the app calls, in one place (atlas/web convention). Paths are relative to
 * `API_BASE_URL`; dynamic segments are functions.
 */
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },
  me: "/me",
  myRole: "/hotel/me/role",

  settings: "/hotel/settings",

  roomTypes: {
    list: "/hotel/room-types",
    byId: (id: string) => `/hotel/room-types/${id}`,
    archive: (id: string) => `/hotel/room-types/${id}/archive`,
  },
  rooms: {
    list: "/hotel/rooms",
    byId: (id: string) => `/hotel/rooms/${id}`,
    archive: (id: string) => `/hotel/rooms/${id}/archive`,
  },

  guests: {
    list: "/hotel/guests",
    byId: (id: string) => `/hotel/guests/${id}`,
    notes: (id: string) => `/hotel/guests/${id}/notes`,
  },

  staff: {
    list: "/hotel/staff",
    role: (userId: string) => `/hotel/staff/${userId}/role`,
    remove: (userId: string) => `/hotel/staff/${userId}/remove`,
  },
  roles: "/hotel/roles",
} as const;
