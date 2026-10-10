/**
 * Every backend route the app calls, in one place. Paths are relative to `API_BASE_URL`; dynamic segments are functions.
 * (Backend: admit/backend/app/admit/*.) Customer routes carry the organizer slug and, for a booking, its magic-link secret `k`.
 */
const e = encodeURIComponent;
const pub = (org: string) => `/admit/public/${e(org)}`;
const withK = (path: string, k: string) => `${path}?k=${e(k)}`;

export const ENDPOINTS = {
  auth: { login: "/auth/login", refresh: "/auth/refresh", logout: "/auth/logout" },
  me: "/admit/me",
  public: {
    events: (org: string) => `${pub(org)}/events`,
    event: (org: string, event: string) => `${pub(org)}/events/${e(event)}`,
    book: (org: string, event: string) => `${pub(org)}/events/${e(event)}/bookings`,
    booking: (org: string, ref: string, k: string) => withK(`${pub(org)}/bookings/${e(ref)}`, k),
    cancel: (org: string, ref: string, k: string) =>
      withK(`${pub(org)}/bookings/${e(ref)}/cancel`, k),
    presign: (org: string, ref: string, k: string) =>
      withK(`${pub(org)}/bookings/${e(ref)}/proof/presign`, k),
    proof: (org: string, ref: string, k: string) =>
      withK(`${pub(org)}/bookings/${e(ref)}/proof`, k),
    tickets: (org: string, ref: string, k: string) =>
      withK(`${pub(org)}/bookings/${e(ref)}/tickets`, k),
    resend: (org: string) => `${pub(org)}/links/resend`,
  },
  events: {
    list: "/admit/events",
    byId: (id: string) => `/admit/events/${id}`,
    publish: (id: string) => `/admit/events/${id}/publish`,
    unpublish: (id: string) => `/admit/events/${id}/unpublish`,
    cancel: (id: string) => `/admit/events/${id}/cancel`,
    archive: (id: string) => `/admit/events/${id}/archive`,
    types: (id: string) => `/admit/events/${id}/ticket-types`,
    methods: (id: string) => `/admit/events/${id}/payment-methods`,
    staff: (id: string) => `/admit/events/${id}/staff`,
    staffMember: (id: string, userId: string) => `/admit/events/${id}/staff/${userId}`,
  },
  venues: { list: "/admit/venues", byId: (id: string) => `/admit/venues/${id}` },
  ticketTypes: { byId: (id: string) => `/admit/ticket-types/${id}` },
  paymentMethods: { byId: (id: string) => `/admit/payment-methods/${id}` },
  bookings: {
    list: "/admit/bookings",
    byId: (id: string) => `/admit/bookings/${id}`,
    cancel: (id: string) => `/admit/bookings/${id}/cancel`,
    customers: "/admit/bookings/customers/list",
  },
  payments: {
    queue: "/admit/payments",
    byId: (id: string) => `/admit/payments/${id}`,
    proof: (id: string) => `/admit/payments/${id}/proof`,
    claim: (id: string) => `/admit/payments/${id}/claim`,
    release: (id: string) => `/admit/payments/${id}/release`,
    approve: (id: string) => `/admit/payments/${id}/approve`,
    reject: (id: string) => `/admit/payments/${id}/reject`,
  },
  tickets: {
    list: "/admit/tickets",
    byId: (id: string) => `/admit/tickets/${id}`,
    revoke: (id: string) => `/admit/tickets/${id}/revoke`,
  },
  checkin: {
    scan: "/admit/checkin",
    events: "/admit/checkin/events",
    overview: (id: string) => `/admit/checkin/events/${id}/overview`,
  },
  emails: { list: "/admit/emails", retry: (id: string) => `/admit/emails/${id}/retry` },
  reports: { overview: "/admit/reports/overview" },
  settings: "/admit/settings",
  team: {
    list: "/admit/team",
    member: (userId: string) => `/admit/team/${userId}`,
    role: (userId: string, role: string) => `/admit/team/${userId}/roles/${role}`,
  },
} as const;
