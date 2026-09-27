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

  rates: {
    list: "/hotel/rates",
    rules: "/hotel/rates/rules",
    discounts: "/hotel/rates/discounts",
    archiveRule: (id: string) => `/hotel/rates/rules/${id}/archive`,
    archiveDiscount: (id: string) => `/hotel/rates/discounts/${id}/archive`,
  },

  availability: {
    search: "/hotel/availability",
    rooms: "/hotel/availability/rooms",
  },
  calendar: "/hotel/calendar",
  reservations: {
    list: "/hotel/reservations",
    byId: (id: string) => `/hotel/reservations/${id}`,
    confirm: (id: string) => `/hotel/reservations/${id}/confirm`,
    cancel: (id: string) => `/hotel/reservations/${id}/cancel`,
    noShow: (id: string) => `/hotel/reservations/${id}/no-show`,
    changeRoom: (id: string) => `/hotel/reservations/${id}/change-room`,
    changeDates: (id: string) => `/hotel/reservations/${id}/change-dates`,
  },

  frontDesk: {
    today: "/hotel/front-desk/today",
    checkIn: (id: string) => `/hotel/reservations/${id}/check-in`,
    checkOut: (id: string) => `/hotel/reservations/${id}/check-out`,
    extend: (id: string) => `/hotel/reservations/${id}/extend`,
  },
  billing: {
    folio: (id: string) => `/hotel/reservations/${id}/folio`,
    charges: (id: string) => `/hotel/reservations/${id}/charges`,
    payments: (id: string) => `/hotel/reservations/${id}/payments`,
    voidCharge: (chargeId: string) => `/hotel/charges/${chargeId}/void`,
    invoice: (id: string) => `/hotel/invoices/${id}`,
  },
} as const;
