import type { Json } from "../../../../../core/kernel/db/json.js";
import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type hotel_counters = {
  organization_id: string;
  name: string;
  value: string;
};
export type hotel_discounts = {
  id: string;
  organization_id: string;
  code: string;
  description: string | null;
  percent_off: string;
  valid_from: Timestamp | null;
  valid_to: Timestamp | null;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_folio_charges = {
  id: string;
  organization_id: string;
  reservation_id: string;
  /**
   * @kyselyType('room' | 'breakfast' | 'extra_bed' | 'minibar' | 'laundry' | 'transfer' | 'service')
   */
  kind: "room" | "breakfast" | "extra_bed" | "minibar" | "laundry" | "transfer" | "service";
  description: string;
  service_date: Timestamp;
  quantity: number;
  unit_price: string;
  amount: string;
  tax_amount: string;
  invoice_id: string | null;
  voided_at: Timestamp | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: Generated<Timestamp>;
};
export type hotel_guest_documents = {
  id: string;
  organization_id: string;
  guest_id: string;
  file_id: string;
  /**
   * @kyselyType('id_document' | 'other')
   */
  kind: "id_document" | "other";
  label: string | null;
  uploaded_by: string | null;
  created_at: Generated<Timestamp>;
};
export type hotel_guest_notes = {
  id: string;
  organization_id: string;
  guest_id: string;
  author_id: string;
  body: string;
  created_at: Generated<Timestamp>;
};
export type hotel_guests = {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  /**
   * ISO 3166-1 alpha-2
   */
  nationality: string | null;
  /**
   * @kyselyType('national_id' | 'passport' | null)
   */
  id_document_type: "national_id" | "passport" | null | null;
  id_document_number: string | null;
  preferences: string | null;
  vip: Generated<boolean>;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_housekeeping_tasks = {
  id: string;
  organization_id: string;
  room_id: string;
  reservation_id: string | null;
  /**
   * @kyselyType('checkout_clean' | 'stayover' | 'deep_clean')
   */
  kind: "checkout_clean" | "stayover" | "deep_clean";
  /**
   * @kyselyType('pending' | 'assigned' | 'in_progress' | 'completed' | 'inspected')
   */
  status: Generated<"pending" | "assigned" | "in_progress" | "completed" | "inspected">;
  /**
   * @kyselyType('low' | 'normal' | 'high')
   */
  priority: Generated<"low" | "normal" | "high">;
  assignee_id: string | null;
  notes: string | null;
  due_date: Timestamp;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
  inspected_at: Timestamp | null;
  inspected_by: string | null;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_invoice_items = {
  id: string;
  organization_id: string;
  invoice_id: string;
  charge_id: string;
  description: string;
  service_date: Timestamp;
  quantity: number;
  unit_price: string;
  amount: string;
  tax_amount: string;
  position: number;
};
export type hotel_invoices = {
  id: string;
  organization_id: string;
  number: string;
  reservation_id: string;
  /**
   * @kyselyType('issued' | 'void')
   */
  status: Generated<"issued" | "void">;
  subtotal: string;
  tax: string;
  total: string;
  tax_rate: string;
  bill_to_name: string;
  issued_by: string | null;
  issued_at: Generated<Timestamp>;
  voided_at: Timestamp | null;
  void_reason: string | null;
  voided_by: string | null;
};
export type hotel_maintenance_events = {
  id: string;
  organization_id: string;
  ticket_id: string;
  seq: Generated<string>;
  /**
   * @kyselyType('reported' | 'assigned' | 'started' | 'note' | 'cost' | 'resolved' | 'reopened' | 'verified' | 'block_extended')
   */
  kind:
    | "reported"
    | "assigned"
    | "started"
    | "note"
    | "cost"
    | "resolved"
    | "reopened"
    | "verified"
    | "block_extended";
  body: string | null;
  actor_id: string | null;
  created_at: Generated<Timestamp>;
};
export type hotel_maintenance_tickets = {
  id: string;
  organization_id: string;
  number: string;
  room_id: string;
  title: string;
  description: string | null;
  /**
   * @kyselyType('low' | 'medium' | 'high' | 'urgent')
   */
  priority: Generated<"low" | "medium" | "high" | "urgent">;
  /**
   * @kyselyType('open' | 'assigned' | 'in_progress' | 'resolved' | 'verified')
   */
  status: Generated<"open" | "assigned" | "in_progress" | "resolved" | "verified">;
  assignee_id: string | null;
  cost: Generated<string>;
  /**
   * @kyselyType('none' | 'maintenance' | 'out_of_service')
   */
  room_impact: Generated<"none" | "maintenance" | "out_of_service">;
  expected_back: Timestamp | null;
  resolution_notes: string | null;
  reported_by: string | null;
  resolved_at: Timestamp | null;
  verified_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_payments = {
  id: string;
  organization_id: string;
  reservation_id: string;
  invoice_id: string | null;
  /**
   * @kyselyType('cash' | 'card' | 'bank_transfer' | 'online')
   */
  method: "cash" | "card" | "bank_transfer" | "online";
  amount: string;
  /**
   * @kyselyType('pending' | 'completed' | 'failed')
   */
  status: "pending" | "completed" | "failed";
  provider: string;
  provider_reference: string | null;
  failure_reason: string | null;
  idempotency_key: string;
  business_date: Timestamp;
  received_by: string | null;
  created_at: Generated<Timestamp>;
  completed_at: Timestamp | null;
};
export type hotel_rate_rules = {
  id: string;
  organization_id: string;
  name: string;
  /**
   * @kyselyType('seasonal' | 'weekend' | 'promotion')
   */
  kind: "seasonal" | "weekend" | "promotion";
  room_type_id: string | null;
  start_date: Timestamp | null;
  end_date: Timestamp | null;
  /**
   * 0 = Sunday … 6 = Saturday (the NIGHT that starts on that weekday)
   */
  days_of_week: number[];
  /**
   * @kyselyType('percent' | 'fixed_rate')
   */
  adjustment_type: "percent" | "fixed_rate";
  adjustment_value: string;
  min_nights: number | null;
  priority: Generated<number>;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_refunds = {
  id: string;
  organization_id: string;
  reservation_id: string;
  payment_id: string;
  /**
   * @kyselyType('cash' | 'card' | 'bank_transfer' | 'online')
   */
  method: "cash" | "card" | "bank_transfer" | "online";
  amount: string;
  reason: string;
  /**
   * @kyselyType('pending' | 'completed' | 'failed')
   */
  status: "pending" | "completed" | "failed";
  provider: string;
  provider_reference: string | null;
  failure_reason: string | null;
  idempotency_key: string;
  business_date: Timestamp;
  refunded_by: string | null;
  created_at: Generated<Timestamp>;
  completed_at: Timestamp | null;
};
export type hotel_reservation_status_history = {
  id: string;
  /**
   * orders transitions within one transaction (shared CURRENT_TIMESTAMP)
   */
  seq: Generated<string>;
  organization_id: string;
  reservation_id: string;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  reason: string | null;
  created_at: Generated<Timestamp>;
};
export type hotel_reservations = {
  id: string;
  organization_id: string;
  code: string;
  guest_id: string;
  room_type_id: string;
  /**
   * @kyselyType('pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show')
   */
  status: "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  /**
   * @kyselyType('direct' | 'phone' | 'walk_in' | 'website' | 'booking_com' | 'expedia')
   */
  source: "direct" | "phone" | "walk_in" | "website" | "booking_com" | "expedia";
  arrival: Timestamp;
  departure: Timestamp;
  adults: number;
  children: Generated<number>;
  /**
   * @kyselyType(Json<Array<{ date: string; rate: number; rule: string | null }>>)
   */
  nightly_rates: Json<Array<{ date: string; rate: number; rule: string | null }>>;
  room_total: string;
  discount_code: string | null;
  discount_amount: Generated<string>;
  total: string;
  notes: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  confirmed_at: Timestamp | null;
  checked_in_at: Timestamp | null;
  checked_out_at: Timestamp | null;
  cancelled_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_room_allocations = {
  id: string;
  organization_id: string;
  room_id: string;
  /**
   * @kyselyType('reservation' | 'block')
   */
  kind: "reservation" | "block";
  reservation_id: string | null;
  /**
   * the maintenance ticket that owns a block (kind = block)
   */
  ticket_id: string | null;
  active: Generated<boolean>;
  reason: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_room_types = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  capacity: number;
  beds: string;
  base_rate: string;
  /**
   * @kyselyType(Json<string[]>)
   */
  amenities: Generated<Json<string[]>>;
  sort_order: Generated<number>;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_rooms = {
  id: string;
  organization_id: string;
  number: string;
  floor: number;
  room_type_id: string;
  /**
   * @kyselyType('clean' | 'dirty' | 'cleaning' | 'inspected')
   */
  housekeeping_status: Generated<"clean" | "dirty" | "cleaning" | "inspected">;
  /**
   * @kyselyType('in_service' | 'maintenance' | 'out_of_service')
   */
  service_status: Generated<"in_service" | "maintenance" | "out_of_service">;
  notes: string | null;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_settings = {
  organization_id: string;
  hotel_name: string;
  time_zone: Generated<string>;
  /**
   * @kyselyType('EGP')
   */
  currency: Generated<"EGP">;
  /**
   * "HH:MM", hotel-local
   */
  check_in_time: Generated<string>;
  /**
   * "HH:MM", hotel-local
   */
  check_out_time: Generated<string>;
  tax_rate: Generated<string>;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type HotelTables = {
  hotel_counters: hotel_counters;
  hotel_discounts: hotel_discounts;
  hotel_folio_charges: hotel_folio_charges;
  hotel_guest_documents: hotel_guest_documents;
  hotel_guest_notes: hotel_guest_notes;
  hotel_guests: hotel_guests;
  hotel_housekeeping_tasks: hotel_housekeeping_tasks;
  hotel_invoice_items: hotel_invoice_items;
  hotel_invoices: hotel_invoices;
  hotel_maintenance_events: hotel_maintenance_events;
  hotel_maintenance_tickets: hotel_maintenance_tickets;
  hotel_payments: hotel_payments;
  hotel_rate_rules: hotel_rate_rules;
  hotel_refunds: hotel_refunds;
  hotel_reservation_status_history: hotel_reservation_status_history;
  hotel_reservations: hotel_reservations;
  hotel_room_allocations: hotel_room_allocations;
  hotel_room_types: hotel_room_types;
  hotel_rooms: hotel_rooms;
  hotel_settings: hotel_settings;
};
