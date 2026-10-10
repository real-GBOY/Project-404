/** Shapes the Admit backend returns. Dates arrive as ISO strings; money is integer minor units (piastres) with a currency. */

export type BookingStatus = "AWAITING_PAYMENT" | "IN_REVIEW" | "CONFIRMED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type TicketStatus = "VALID" | "USED" | "REVOKED";
export type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type EmailStatus = "QUEUED" | "ACCEPTED" | "DELIVERED" | "RETRYING" | "FAILED";
export type EmailType = "INSTRUCTIONS" | "PROOF_RECEIVED" | "TICKETS" | "REJECTED" | "EXPIRED" | "CANCELLED" | "MAGIC_LINK";
export type EventStatus = "draft" | "published" | "cancelled" | "archived";
export type PaymentMethodType = "instapay" | "wallet" | "bank" | "cash_deposit" | "other";
export type AvailabilityLabel = "available" | "selling_fast" | "sold_out" | "ended";
export type ScanResult = "ADMITTED" | "ALREADY_USED" | "INVALID";
export type InvalidReason = "unknown" | "revoked" | "other_event" | "event_closed";

// ---- auth -----------------------------------------------------------------------------------------------------------
export interface LoginResponse {
  tokens: { accessToken: string; refreshToken: string };
}
export interface Me {
  user: { id: string; email: string; name: string };
  organizer: { id: string; slug: string; name: string; supportEmail: string | null; logoUrl: string | null; timeZone: string };
  permissions: string[];
  /** `all` = every event of the organizer; `assigned` = only the events they are assigned to. */
  eventReach: "all" | "assigned";
}

// ---- customer (public) ----------------------------------------------------------------------------------------------
export interface EventCard {
  id: string;
  slug: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
  coverUrl: string | null;
  currency: string;
  venue: { name: string; area: string };
  minPriceMinor: number | null;
  availability: AvailabilityLabel;
}
export interface PublicCatalogue {
  organizer: { slug: string; name: string; supportEmail: string | null; logoUrl: string | null };
  events: EventCard[];
  categories: { name: string; count: number }[];
}
export interface PublicTicketType {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  maxPerBooking: number;
  /** Capped at 99 for display. */
  remaining: number;
  onSale: boolean;
}
export interface PublicEvent extends EventCard {
  description: string;
  program: { time: string; title: string; detail?: string }[];
  policies: { refund?: string; age?: string; entry?: string };
  namedTickets: boolean;
  maxPerBooking: number;
  venue: { name: string; area: string; address: string; mapUrl: string | null };
  organizer: { slug: string; name: string; supportEmail: string | null };
  ticketTypes: PublicTicketType[];
}
export interface CreateBookingBody {
  items: { ticketTypeId: string; quantity: number; holderNames?: string[] }[];
  customer: { name: string; email: string; phone: string };
  policyAck: boolean;
}
export interface CreatedBooking {
  created: boolean;
  ref: string;
  holdExpiresAt: string;
  totalMinor: number;
  currency: string;
  links: { status: string; upload: string };
}
export interface PaymentMethodView {
  id: string;
  type: PaymentMethodType;
  label: string;
  recipientName: string;
  identifier: string;
  instructions: string[];
}
export interface TimelineEntry {
  step: string;
  state: "done" | "pending" | "failed";
  at: string;
  note: string | null;
}
export interface BookingLine {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}
export interface GuestBooking {
  ref: string;
  status: BookingStatus;
  event: { id: string; slug: string; title: string; startsAt: string; endsAt: string; venue: { name: string; area: string; address: string; mapUrl: string | null }; coverUrl: string | null; namedTickets: boolean };
  customer: { name: string; emailMasked: string };
  lines: BookingLine[];
  totalMinor: number;
  currency: string;
  holdExpiresAt: string;
  rejectionReason: string | null;
  canResubmit: boolean;
  paymentMethods: PaymentMethodView[];
  timeline: TimelineEntry[];
  ticketCount: number;
  emailStatus: EmailStatus | null;
}
export interface GuestTicket {
  id: string;
  seq: number;
  holderName: string;
  ticketType: string;
  status: TicketStatus;
  checkedInAt: string | null;
  /** Same-origin path of the QR image (the token itself is never in JSON). */
  qrImageUrl: string | null;
}
export interface GuestTickets {
  bookingStatus: BookingStatus;
  event: { title: string; startsAt: string; endsAt: string; venue: { name: string; address: string; mapUrl: string | null } };
  tickets: GuestTicket[];
}
export interface PresignedProof {
  fileId: string;
  upload: { url: string; method: string; headers?: Record<string, string>; expiresAt?: string };
}
export interface SubmitProofBody {
  fileId: string;
  methodId?: string | null;
  transactionId?: string | null;
  sentFrom?: string | null;
  amountMinor?: number | null;
}

// ---- organizer ------------------------------------------------------------------------------------------------------
export interface Venue {
  id: string;
  name: string;
  area: string;
  address: string;
  mapUrl: string | null;
  capacity: number;
}
export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string;
  priceMinor: number;
  quantity: number;
  maxPerBooking: number;
  onSale: boolean;
  sortOrder: number;
  held: number;
  remaining: number;
}
export interface PaymentMethod {
  id: string;
  eventId: string;
  type: PaymentMethodType;
  label: string;
  recipientName: string;
  identifier: string;
  instructions: string[];
  enabled: boolean;
  sortOrder: number;
}
export interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  startsAt: string;
  endsAt: string;
  coverUrl: string | null;
  status: EventStatus;
  maxPerBooking: number;
  namedTickets: boolean;
  holdHours: number;
  allowResubmission: boolean;
  currency: string;
  supportEmail: string | null;
  policies: { refund?: string; age?: string; entry?: string };
  program: { time: string; title: string; detail?: string }[];
  publishedAt: string | null;
  venue: Venue;
  ticketTypes: TicketType[];
  paymentMethods: PaymentMethod[];
  capacityAllocated: number;
}
export interface EventInput {
  slug: string;
  title: string;
  category: string;
  description: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  coverUrl: string | null;
  maxPerBooking: number;
  namedTickets: boolean;
  holdHours: number;
  allowResubmission: boolean;
  supportEmail: string | null;
  policies: { refund?: string; age?: string; entry?: string };
  program: { time: string; title: string; detail?: string }[];
}
export interface BookingSummary {
  id: string;
  ref: string;
  status: BookingStatus;
  eventId: string;
  eventTitle: string;
  customerName: string;
  email: string;
  phone: string;
  totalMinor: number;
  currency: string;
  ticketCount: number;
  holdExpiresAt: string;
  version: number;
  createdAt: string;
}
export interface BookingDetail {
  id: string;
  ref: string;
  status: BookingStatus;
  version: number;
  event: { id: string; title: string; startsAt: string };
  customer: { name: string; email: string; phone: string };
  totalMinor: number;
  currency: string;
  holdExpiresAt: string;
  rejectionReason: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  lines: BookingLine[];
  timeline: (TimelineEntry & { actorId: string | null })[];
  submissions: { id: string; status: SubmissionStatus; txnId: string | null; sentFrom: string | null; amountMinor: number | null; createdAt: string; decidedAt: string | null; decidedBy: string | null; customerReason: string | null; internalNote: string | null }[];
  tickets: { id: string; seq: number; holderName: string; ticketType: string; status: TicketStatus; checkedInAt: string | null; checkedInGate: string | null; revokedAt: string | null; revokedReason: string | null }[];
  emails: { id: string; type: EmailType; status: EmailStatus; attempts: number; lastError: string | null; sentAt: string | null; createdAt: string }[];
}
export interface QueueItem {
  submissionId: string;
  version: number;
  bookingId: string;
  bookingRef: string;
  customer: string;
  eventId: string;
  eventTitle: string;
  amountMinor: number;
  currency: string;
  method: string | null;
  submittedAt: string;
  flags: ("amount_mismatch" | "duplicate_transaction" | "resubmission")[];
  lock: { by: string; byName: string | null; at: string } | null;
}
export interface PaymentDetail extends QueueItem {
  status: SubmissionStatus;
  txnId: string | null;
  sentFrom: string | null;
  declaredAmountMinor: number | null;
  bookingStatus: BookingStatus;
  proofUrl: string;
  history: { id: string; status: SubmissionStatus; at: string; decidedAt: string | null; customerReason: string | null; internalNote: string | null }[];
}
export interface ClaimResult {
  heldByMe: boolean;
  claimedBy: string | null;
  claimedAt: string | null;
  version: number;
}
export interface DecisionResult {
  submissionId: string;
  status: SubmissionStatus;
  bookingStatus: BookingStatus;
  ticketsIssued: number;
  decidedAt: string | null;
  replayed: boolean;
}
export interface TicketRow {
  id: string;
  bookingRef: string;
  eventId: string;
  eventTitle: string;
  ticketType: string;
  holderName: string;
  seq: number;
  status: TicketStatus;
  checkedInAt: string | null;
  checkedInGate: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}
export interface ScanOutcome {
  result: ScanResult;
  reason?: InvalidReason;
  ticket?: { id: string; holder: string; type: string };
  firstCheckInAt?: string;
  firstCheckInBy?: string;
  gate?: string;
  at?: string;
}
export interface ScannerEvents {
  staff: { name: string; userId: string };
  events: { id: string; title: string; startsAt: string; endsAt: string; venue: string; gate: string; checkedIn: number; remaining: number }[];
}
export interface CheckinOverview {
  event: { id: string; title: string; startsAt: string };
  totals: { validTickets: number; checkedIn: number; revoked: number; remaining: number };
  byType: { ticketTypeId: string; name: string; total: number; checkedIn: number }[];
  arrivals: { at: string; count: number }[];
  scans: { id: string; at: string; result: ScanResult; reason: InvalidReason | null; method: "QR" | "MANUAL"; ticketId: string | null; holder: string | null; gate: string; staff: string }[];
}
export interface EmailRow {
  id: string;
  at: string;
  to: string;
  type: EmailType;
  bookingRef: string | null;
  status: EmailStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
}
export interface ReportsOverview {
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  revenueMinor: { currency: string; amountMinor: number }[];
  tickets: { valid: number; checkedIn: number; revoked: number };
  paymentsWaiting: { count: number; oldestMinutes: number | null };
  emailsFailed: number;
  byTicketType: { ticketTypeId: string; name: string; eventId: string; capacity: number; sold: number; held: number; revenueMinor: number }[];
  salesByDay: { day: string; bookings: number; revenueMinor: number }[];
}
export interface CustomerRow {
  email: string;
  name: string;
  phone: string;
  bookings: number;
  attended: number;
  spendMinor: number;
  latestStatus: BookingStatus;
  lastBookingAt: string;
}
export interface StaffAssignment {
  userId: string;
  name: string;
  email: string;
  gate: string;
}
export interface OrganizerSettings {
  organizerName: string;
  supportEmail: string | null;
  logoUrl: string | null;
  timeZone: string;
}
export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  membershipRole: string;
  roles: { key: string; name: string }[];
}
export interface TeamRole {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}
export interface Team {
  members: TeamMember[];
  roles: TeamRole[];
}
