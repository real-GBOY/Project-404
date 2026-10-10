/**
 * The typed API layer, the ONLY place components' data comes from. One thin, documented call per backend route (no business rules,
 * no URL building elsewhere). Hooks depend on `api`; swapping transport or faking it for tests happens here.
 */
import { ENDPOINTS as E } from "@/config/endpoints";
import { http } from "@/services/http";
import { downloadProtected } from "@/lib/download";
import type * as T from "./types";

const anon = { anonymous: true } as const;

/** Customer calls: no sign-in. A booking is reached with its magic-link secret `k`. */
export const publicApi = {
  catalogue: (org: string) => http<T.PublicCatalogue>(E.public.events(org), anon),
  event: (org: string, event: string) => http<T.PublicEvent>(E.public.event(org, event), anon),
  /** `idempotencyKey` makes a double click or a retried request return the first booking instead of booking twice. */
  book: (org: string, event: string, body: T.CreateBookingBody, idempotencyKey: string) =>
    http<T.CreatedBooking>(E.public.book(org, event), {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
      ...anon,
    }),
  booking: (org: string, ref: string, k: string) =>
    http<T.GuestBooking>(E.public.booking(org, ref, k), anon),
  cancel: (org: string, ref: string, k: string) =>
    http<T.GuestBooking>(E.public.cancel(org, ref, k), { method: "POST", ...anon }),
  tickets: (org: string, ref: string, k: string) =>
    http<T.GuestTickets>(E.public.tickets(org, ref, k), anon),
  presignProof: (
    org: string,
    ref: string,
    k: string,
    file: { fileName: string; contentType: string; byteSize: number },
  ) =>
    http<T.PresignedProof>(E.public.presign(org, ref, k), { method: "POST", body: file, ...anon }),
  submitProof: (org: string, ref: string, k: string, body: T.SubmitProofBody) =>
    http<{ submissionId: string; status: "IN_REVIEW" }>(E.public.proof(org, ref, k), {
      method: "POST",
      body,
      ...anon,
    }),
  resendLink: (org: string, ref: string, email: string) =>
    http<{ accepted: true }>(E.public.resend(org), {
      method: "POST",
      body: { ref, email },
      ...anon,
    }),
};

export const authApi = {
  login: (email: string, password: string) =>
    http<T.LoginResponse>(E.auth.login, { method: "POST", body: { email, password }, ...anon }),
  logout: (refreshToken: string) =>
    http<void>(E.auth.logout, { method: "POST", body: { refreshToken }, ...anon }),
};

const list = <R>(path: string) => http<{ items: R[] }>(path).then((r) => r.items);

export const adminApi = {
  me: () => http<T.Me>(E.me),
  account: {
    changePassword: (currentPassword: string, newPassword: string) =>
      http<void>(E.mePassword, { method: "POST", body: { currentPassword, newPassword } }),
  },

  events: {
    list: () => list<T.AdminEvent>(E.events.list),
    get: (id: string) => http<T.AdminEvent>(E.events.byId(id)),
    create: (body: T.EventInput) => http<T.AdminEvent>(E.events.list, { method: "POST", body }),
    update: (id: string, body: Partial<T.EventInput>) =>
      http<T.AdminEvent>(E.events.byId(id), { method: "PATCH", body }),
    publish: (id: string) => http<T.AdminEvent>(E.events.publish(id), { method: "POST" }),
    unpublish: (id: string) => http<T.AdminEvent>(E.events.unpublish(id), { method: "POST" }),
    cancel: (id: string) => http<T.AdminEvent>(E.events.cancel(id), { method: "POST" }),
    archive: (id: string) => http<T.AdminEvent>(E.events.archive(id), { method: "POST" }),
    remove: (id: string) => http<void>(E.events.byId(id), { method: "DELETE" }),
    addType: (id: string, body: Omit<T.TicketType, "id" | "eventId" | "held" | "remaining">) =>
      http<T.TicketType>(E.events.types(id), { method: "POST", body }),
    addMethod: (id: string, body: Omit<T.PaymentMethod, "id" | "eventId">) =>
      http<T.PaymentMethod>(E.events.methods(id), { method: "POST", body }),
    staff: (id: string) => list<T.StaffAssignment>(E.events.staff(id)),
    assign: (id: string, userId: string, gate: string) =>
      http<{ items: T.StaffAssignment[] }>(E.events.staffMember(id, userId), {
        method: "PUT",
        body: { gate },
      }).then((r) => r.items),
    unassign: (id: string, userId: string) =>
      http<void>(E.events.staffMember(id, userId), { method: "DELETE" }),
  },
  venues: {
    list: () => list<T.Venue>(E.venues.list),
    create: (body: Omit<T.Venue, "id">) => http<T.Venue>(E.venues.list, { method: "POST", body }),
    update: (id: string, body: Partial<Omit<T.Venue, "id">>) =>
      http<T.Venue>(E.venues.byId(id), { method: "PATCH", body }),
    remove: (id: string) => http<void>(E.venues.byId(id), { method: "DELETE" }),
  },
  ticketTypes: {
    update: (
      id: string,
      body: Partial<Omit<T.TicketType, "id" | "eventId" | "held" | "remaining">>,
    ) => http<T.TicketType>(E.ticketTypes.byId(id), { method: "PATCH", body }),
    remove: (id: string) => http<void>(E.ticketTypes.byId(id), { method: "DELETE" }),
  },
  paymentMethods: {
    update: (id: string, body: Partial<Omit<T.PaymentMethod, "id" | "eventId">>) =>
      http<T.PaymentMethod>(E.paymentMethods.byId(id), { method: "PATCH", body }),
    remove: (id: string) => http<void>(E.paymentMethods.byId(id), { method: "DELETE" }),
  },

  bookings: {
    list: (q: {
      eventId?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }) => http<{ items: T.BookingSummary[]; total: number }>(E.bookings.list, { query: q }),
    get: (id: string) => http<T.BookingDetail>(E.bookings.byId(id)),
    cancel: (id: string, reason: string) =>
      http<void>(E.bookings.cancel(id), { method: "POST", body: { reason } }),
    resendTickets: (id: string) => http<void>(E.bookings.resend(id), { method: "POST" }),
    exportCsv: (q: { eventId?: string; status?: string; search?: string }) =>
      downloadProtected(E.bookings.exportCsv + toQuery(q), "admit-bookings.csv"),
    customers: (q: { search?: string; limit?: number; offset?: number }) =>
      http<{ items: T.CustomerRow[]; total: number }>(E.bookings.customers, { query: q }),
  },

  payments: {
    queue: (eventId?: string) =>
      list<T.QueueItem>(
        E.payments.queue + (eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""),
      ),
    get: (id: string) => http<T.PaymentDetail>(E.payments.byId(id)),
    /** The proof file as a blob (authorized fetch: it is never reachable by a plain link). */
    async proof(id: string): Promise<{ blob: Blob; type: string }> {
      const res = await fetch(http.withApiBase(E.payments.proof(id)), {
        headers: http.bearerHeaders(),
      });
      if (!res.ok) throw new Error(`proof ${res.status}`);
      const blob = await res.blob();
      return { blob, type: res.headers.get("content-type") ?? blob.type };
    },
    claim: (id: string) => http<T.ClaimResult>(E.payments.claim(id), { method: "POST" }),
    release: (id: string) => http<void>(E.payments.release(id), { method: "POST" }),
    approve: (
      id: string,
      body: { version: number; idempotencyKey: string; internalNote?: string | null },
    ) => http<T.DecisionResult>(E.payments.approve(id), { method: "POST", body }),
    reject: (
      id: string,
      body: {
        version: number;
        idempotencyKey: string;
        reason: string;
        internalNote?: string | null;
      },
    ) => http<T.DecisionResult>(E.payments.reject(id), { method: "POST", body }),
  },

  tickets: {
    list: (q: { eventId?: string; q?: string; limit?: number; offset?: number }) =>
      list<T.TicketRow>(E.tickets.list + toQuery(q)),
    exportCsv: (q: { eventId?: string; q?: string }) =>
      downloadProtected(E.tickets.exportCsv + toQuery(q), "admit-tickets.csv"),
    revoke: (id: string, reason: string) =>
      http<T.TicketRow>(E.tickets.revoke(id), { method: "POST", body: { reason } }),
  },

  audit: {
    list: (q: { action?: string; from?: string; cursor?: string; limit?: number }) =>
      http<{ records: T.AuditRecord[]; nextCursor?: string }>(E.audit, { query: q }),
  },

  checkin: {
    scan: (
      body: { token?: string; ticketId?: string; eventId: string; gate?: string },
      signal?: AbortSignal,
    ) => http<T.ScanOutcome>(E.checkin.scan, { method: "POST", body, signal }),
    events: () => http<T.ScannerEvents>(E.checkin.events),
    overview: (id: string) => http<T.CheckinOverview>(E.checkin.overview(id)),
  },

  emails: {
    list: (q: { status?: string; limit?: number; offset?: number }) =>
      http<{ items: T.EmailRow[]; failedCount: number }>(E.emails.list, { query: q }),
    retry: (id: string) => http<void>(E.emails.retry(id), { method: "POST" }),
  },

  reports: {
    overview: (q: { eventId?: string; days?: number }) =>
      http<T.ReportsOverview>(E.reports.overview, { query: q }),
  },

  settings: {
    get: () => http<T.OrganizerSettings>(E.settings),
    update: (body: Partial<T.OrganizerSettings>) =>
      http<T.OrganizerSettings>(E.settings, { method: "PATCH", body }),
  },

  team: {
    get: () => http<T.Team>(E.team.list),
    /** With `account` the owner creates the login on the person's behalf (name + a starting password). */
    add: (email: string, roleKey: string, account?: { name: string; password: string }) =>
      http<void>(E.team.list, {
        method: "POST",
        body: { email, roleKey, ...(account ? { account } : {}) },
      }),
    setPassword: (userId: string, newPassword: string) =>
      http<void>(E.team.password(userId), { method: "POST", body: { newPassword } }),
    removeMember: (userId: string) => http<void>(E.team.member(userId), { method: "DELETE" }),
    removeRole: (userId: string, roleKey: string) =>
      http<void>(E.team.role(userId, roleKey), { method: "DELETE" }),
  },
};

function toQuery(q: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type { T as ApiTypes };
