import type { Json } from "../../../../../core/kernel/db/json.js";
import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type admit_booking_lines = {
  id: string;
  organization_id: string;
  booking_id: string;
  ticket_type_id: string;
  quantity: number;
  unit_price_minor: number;
  /**
   * @kyselyType(Json<string[]>)
   */
  holder_names: Generated<Json<string[]>>;
};
export type admit_booking_timeline = {
  id: string;
  organization_id: string;
  booking_id: string;
  step: string;
  /**
   * @kyselyType('done' | 'pending' | 'failed')
   */
  state: Generated<"done" | "pending" | "failed">;
  actor_id: string | null;
  note: string | null;
  at: Generated<Timestamp>;
};
export type admit_bookings = {
  id: string;
  organization_id: string;
  event_id: string;
  ref: string;
  access_hash: string;
  /**
   * @kyselyType('AWAITING_PAYMENT' | 'IN_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED')
   */
  status: Generated<"AWAITING_PAYMENT" | "IN_REVIEW" | "CONFIRMED" | "REJECTED" | "EXPIRED" | "CANCELLED">;
  customer_name: string;
  email: string;
  phone: string;
  total_minor: number;
  currency: string;
  hold_expires_at: Timestamp;
  policy_ack: Generated<boolean>;
  rejection_reason: string | null;
  version: Generated<number>;
  idempotency_key: string | null;
  confirmed_at: Timestamp | null;
  cancelled_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_email_messages = {
  id: string;
  organization_id: string;
  booking_id: string | null;
  /**
   * @kyselyType('INSTRUCTIONS' | 'PROOF_RECEIVED' | 'TICKETS' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | 'MAGIC_LINK')
   */
  type: "INSTRUCTIONS" | "PROOF_RECEIVED" | "TICKETS" | "REJECTED" | "EXPIRED" | "CANCELLED" | "MAGIC_LINK";
  to_email: string;
  /**
   * @kyselyType(Json<Record<string, unknown>>)
   */
  payload: Generated<Json<Record<string, unknown>>>;
  /**
   * @kyselyType('QUEUED' | 'ACCEPTED' | 'DELIVERED' | 'RETRYING' | 'FAILED')
   */
  status: Generated<"QUEUED" | "ACCEPTED" | "DELIVERED" | "RETRYING" | "FAILED">;
  attempts: Generated<number>;
  max_attempts: Generated<number>;
  next_attempt_at: Generated<Timestamp>;
  claimed_by: string | null;
  claimed_at: Timestamp | null;
  last_error: string | null;
  provider_message_id: string | null;
  dedupe_key: string | null;
  sent_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_event_staff = {
  organization_id: string;
  event_id: string;
  user_id: string;
  gate: Generated<string>;
  created_at: Generated<Timestamp>;
};
export type admit_events = {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  category: Generated<string>;
  description: Generated<string>;
  venue_id: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
  cover_url: string | null;
  /**
   * @kyselyType('draft' | 'published' | 'cancelled' | 'archived')
   */
  status: Generated<"draft" | "published" | "cancelled" | "archived">;
  max_per_booking: Generated<number>;
  named_tickets: Generated<boolean>;
  hold_hours: Generated<number>;
  allow_resubmission: Generated<boolean>;
  currency: Generated<string>;
  support_email: string | null;
  /**
   * @kyselyType(Json<Record<string, string>>)
   */
  policies: Generated<Json<Record<string, string>>>;
  /**
   * @kyselyType(Json<Array<{ time: string; title: string; detail?: string }>>)
   */
  program: Generated<Json<Array<{ time: string; title: string; detail?: string }>>>;
  published_at: Timestamp | null;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_payment_methods = {
  id: string;
  organization_id: string;
  event_id: string;
  /**
   * @kyselyType('instapay' | 'wallet' | 'bank' | 'cash_deposit' | 'other')
   */
  type: "instapay" | "wallet" | "bank" | "cash_deposit" | "other";
  label: string;
  recipient_name: string;
  identifier: string;
  /**
   * @kyselyType(Json<string[]>)
   */
  instructions: Generated<Json<string[]>>;
  enabled: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_payment_submissions = {
  id: string;
  organization_id: string;
  booking_id: string;
  method_id: string | null;
  file_id: string;
  txn_id: string | null;
  sent_from: string | null;
  amount_minor: number | null;
  /**
   * @kyselyType('SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED')
   */
  status: Generated<"SUBMITTED" | "APPROVED" | "REJECTED" | "SUPERSEDED">;
  version: Generated<number>;
  claimed_by: string | null;
  claimed_at: Timestamp | null;
  decided_by: string | null;
  decided_at: Timestamp | null;
  customer_reason: string | null;
  internal_note: string | null;
  decision_key: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_rate_limits = {
  bucket: string;
  window_start: Timestamp;
  hits: Generated<number>;
};
export type admit_scan_attempts = {
  id: string;
  organization_id: string;
  event_id: string;
  ticket_id: string | null;
  /**
   * @kyselyType('ADMITTED' | 'ALREADY_USED' | 'INVALID')
   */
  result: "ADMITTED" | "ALREADY_USED" | "INVALID";
  /**
   * @kyselyType('unknown' | 'revoked' | 'other_event' | 'event_closed')
   */
  reason: "unknown" | "revoked" | "other_event" | "event_closed" | null;
  /**
   * @kyselyType('QR' | 'MANUAL')
   */
  method: Generated<"QR" | "MANUAL">;
  gate: Generated<string>;
  staff_id: string | null;
  scanned_at: Generated<Timestamp>;
};
export type admit_settings = {
  organization_id: string;
  /**
   * @kyselyType(Json<Record<string, unknown>>)
   */
  data: Generated<Json<Record<string, unknown>>>;
  updated_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_ticket_types = {
  id: string;
  organization_id: string;
  event_id: string;
  name: string;
  description: Generated<string>;
  price_minor: number;
  quantity: number;
  max_per_booking: Generated<number>;
  on_sale: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_tickets = {
  id: string;
  organization_id: string;
  booking_id: string;
  event_id: string;
  ticket_type_id: string;
  seq: number;
  holder_name: string;
  token_hash: string;
  /**
   * @kyselyType('VALID' | 'USED' | 'REVOKED')
   */
  status: Generated<"VALID" | "USED" | "REVOKED">;
  checked_in_at: Timestamp | null;
  checked_in_gate: string | null;
  checked_in_by: string | null;
  revoked_at: Timestamp | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type admit_venues = {
  id: string;
  organization_id: string;
  name: string;
  area: Generated<string>;
  address: Generated<string>;
  map_url: string | null;
  capacity: number;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type AdmitTables = {
  admit_booking_lines: admit_booking_lines;
  admit_booking_timeline: admit_booking_timeline;
  admit_bookings: admit_bookings;
  admit_email_messages: admit_email_messages;
  admit_event_staff: admit_event_staff;
  admit_events: admit_events;
  admit_payment_methods: admit_payment_methods;
  admit_payment_submissions: admit_payment_submissions;
  admit_rate_limits: admit_rate_limits;
  admit_scan_attempts: admit_scan_attempts;
  admit_settings: admit_settings;
  admit_ticket_types: admit_ticket_types;
  admit_tickets: admit_tickets;
  admit_venues: admit_venues;
};
